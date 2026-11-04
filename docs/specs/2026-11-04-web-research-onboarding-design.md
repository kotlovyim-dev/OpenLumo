# Web Research Onboarding Design

Date: 2026-11-04
Status: Approved

## 1. Brief

Onboarding today asks for a brand name and a website, crawls up to ten pages of the site and writes Brand DNA from those pages alone. Competitors stay empty unless the site names them, and nothing reflects what the rest of the web says about the brand or its market.

The new flow needs one input: a link. Lumo reads the site, researches the brand on the live web, and fills in the name, products and features, audience and competitors, each finding backed by a source link and a research date. Markets change quickly, so the research can be refreshed on demand.

### Goals

- A brand can be created from a URL alone. The name is discovered, not typed.
- Brand DNA gains product features, audience channels and rich competitor profiles with positioning, strengths, weaknesses and sources.
- Research uses fresh web results through the OpenRouter web plugin, with the API key the instance already has.
- A "Refresh research" action re-runs the research for an existing brand.
- Research is best effort: when it fails, onboarding still finishes from the site alone.

### Non-goals

- Scheduled or automatic refreshes.
- Our own tool-using browse agent or a second search provider.
- Research history or diffs between research runs.
- Competitor tracking over time.

## 2. Flow

1. The New brand form shows one required field, the website. A "No website? Describe your brand yourself" toggle switches to the existing manual path with a brand name field.
2. Jobs run as `brand.crawl` → `brand.research` → `brand.synthesize-dna`.
3. The onboarding screen shows "Reading your site", then "Researching your market", then "Learning your brand".
4. After synthesis the brand takes the discovered name from the DNA, replacing the hostname placeholder. Saving Brand DNA later keeps the brand name in step with `identity.name`.

## 3. Data

### Brand DNA

- `identity.features: string[]`: what the product does, as concrete capabilities.
- `audience.channels: string[]`: where the audience spends time, such as communities, platforms and publications.
- `competitors` changes from names to records:

```ts
{ name: string; url: string; positioning: string; strengths: string[]; weaknesses: string[]; sourceUrls: string[] }
```

Stored DNA written before this change is upgraded when it is read: missing lists become empty and a competitor name `"Acme"` becomes `{ name: "Acme", url: "", positioning: "", strengths: [], weaknesses: [], sourceUrls: [] }`. No data migration is needed.

### Research

A new `brand_research` table, one row per brand:

| Column | Meaning |
|---|---|
| `brand_id` | Primary key, references `brands` |
| `status` | `succeeded` or `failed`, the outcome of the latest attempt |
| `brief` | The cited research brief from the last successful run |
| `sources` | `{ url, title }[]` cited by that brief |
| `findings` | The structured research from that run |
| `researched_at` | Time of the last successful run |
| `attempted_at` | Time of the latest attempt |

A failed attempt updates only `status` and `attempted_at`, so the last good research stays visible.

## 4. Components

### Providers

- `TextRequest.webSearch?: { maxResults: number }`. The OpenRouter adapter sends it as `plugins: [{ id: 'web', max_results }]`.
- `TextResult.citations?: { url: string; title: string }[]`, read from `url_citation` annotations on the response message. Only http and https URLs are kept, deduplicated by URL.
- The search fee arrives in `usage.cost` and is recorded like any other job cost.
- The fake provider passes citations through when a scripted response includes them.

### Core, `packages/core/src/research/`

- `research-schema.ts`: the Zod schema for findings (name, features, audience with channels, competitors) and the stored research row type.
- `research-prompts.ts`: builds both prompts. Site pages and the brief are wrapped as untrusted content. The research prompt states today's date and asks for current information.
- `research-brand.ts`: step one asks the brain model, with web search on and eight results, for a cited brief covering the brand name, products and features, audience, three to five direct competitors and recent changes. Step two turns the brief into findings with `generateObject`, without web search. Competitor `sourceUrls` that are not among the citations are removed, at most five competitors are kept, and competitors on the brand's own site are dropped.
- `verify-competitors.ts`: fetches each competitor URL with `safeFetch`, with private-address protection and a short timeout. Competitors whose site cannot be reached, resolves to a blocked address or answers 404 or 410 are dropped. A site that answers with any other status, such as a 403 from a bot wall, exists and is kept. Competitors without a URL are kept.
- `apply-research.ts`: copies findings into a DNA object, replacing `identity.features`, `audience` and `competitors`, and filling `identity.name` only when it is empty.
- `research-repository.ts`: saves a successful run, records a failed attempt and loads the row.

### Worker

`brand.research`, with payload `{ brandId, refresh?: boolean }`:

- Reports "Researching your market", runs the research and records usage for each model call.
- Onboarding: saves the result, then enqueues `brand.synthesize-dna`. A research error is caught, recorded as a failed attempt, logged, and synthesis is still enqueued.
- Refresh: saves the result, then applies the findings to the saved DNA with `saveBrandDnaIfVersion`, reloading and re-applying up to three times when the DNA changed in the meantime. A failed refresh records a failed attempt and leaves the DNA untouched.
- Aborts from the worker's signal are rethrown, never recorded as failed research.

`brand.crawl` enqueues `brand.research` instead of `brand.synthesize-dna`. The thin-site fallback to manual input is unchanged.

`brand.synthesize-dna` includes the research brief in its prompt, applies the findings over the generated DNA, saves it and renames the brand. Once research has produced findings, competitors come only from those verified findings, never from the synthesis output. The prompt no longer tells the model to leave competitors empty.

### Web

- New brand form: website mode by default, manual mode behind the toggle. The service keeps accepting either input.
- Onboarding progress listens for `brand.research` steps.
- Brand DNA page:
  - Features and audience channels chip fields.
  - A competitor editor with one card per competitor: name, website, positioning, strengths, weaknesses, and links to its sources.
  - A research panel: research date, source count, a collapsible source list, a failure notice when the latest attempt failed, and the "Refresh research" button for owners and editors with the note "Replaces competitors, features and audience with fresh findings." The panel follows `brand.research` events and refreshes the page when the job ends.
- `requestResearchRefresh` service and action: editor access, enqueues `brand.research` with `refresh: true`, keyed by brand and the latest attempt time so double clicks queue one job.

## 5. Failure handling

| Situation | Result |
|---|---|
| Web search or model fails during onboarding | Research recorded as failed, DNA written from the site alone, panel shows the failure and offers Refresh |
| Thin site | Falls back to manual input as today, research is not run |
| Competitor site unreachable or private | Competitor dropped |
| Model cites nothing or invents source URLs | Uncited source URLs removed |
| Refresh fails | DNA unchanged, previous research kept, failure shown |
| DNA edited while refresh runs | Findings re-applied on the newer DNA |

## 6. Testing

- Providers: the request carries the web plugin, citations are parsed and filtered, requests without web search are unchanged.
- Core: prompts wrap untrusted content and state the date, uncited URLs and own-site competitors are removed, competitor verification against a local server, `applyResearch` touches only the research sections, stored DNA with name-only competitors is upgraded.
- Worker: crawl → research → DNA with the fixture site, research failure still produces DNA and a failed research row, refresh updates research sections and keeps voice and visuals, refresh survives a version conflict.
- Web: brand creation from a URL alone, refresh action access rules.
- End to end: the golden path creates a brand from a link only, the discovered name appears, competitor cards and the research panel are shown.
