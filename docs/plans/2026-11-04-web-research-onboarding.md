# Web Research Onboarding Implementation Plan

**Goal:** Create a brand from a link alone and fill its name, features, audience and competitors from live web research, with a manual refresh.

**Architecture:** A new `brand.research` job sits between crawl and DNA synthesis. It asks the brain model, with the OpenRouter web plugin on, for a cited brief, then extracts structured findings, verifies competitor sites and stores the result in `brand_research`. Findings are applied over the generated DNA, and a refresh re-applies them to the saved DNA.

**Tech Stack:** TypeScript, Zod 4, Drizzle, pg-boss, Next.js, Vitest, Playwright.

**Spec:** `docs/specs/2026-11-04-web-research-onboarding-design.md`

## Global Constraints

- No code comments, no AI attribution in commits.
- Web search uses `plugins: [{ id: 'web', max_results: 8 }]`, no new settings or keys.
- At most five competitors, each verified with `safeFetch` and `config.allowPrivateHosts`.
- Refresh copy: "Replaces competitors, features and audience with fresh findings."
- Progress step copy: "Researching your market".
- Model-facing schemas have no optional fields.

## Review Focus

- The chosen brain model rejects the web plugin: research is recorded as failed and the DNA is still written. Test in Task 5.
- A competitor URL resolving to a private address: the competitor is dropped. Test in Task 4.
- Stored DNA from before this change, with name-only competitors and no features or channels: the DNA page and every job still load it. Test in Task 2.
- "Refresh research" clicked twice: one job is queued. Test in Task 6.
- The brief cites nothing: findings are saved with empty `sourceUrls` and an empty source list. Test in Task 4.

---

### Task 1: Web search and citations in providers

**Files:** modify `packages/providers/src/types.ts`, `packages/providers/src/openrouter/openrouter-language-model.ts`; test `packages/providers/test/openrouter/openrouter-language-model.test.ts`

**Produces:** `TextRequest.webSearch?: { maxResults: number }`, `Citation = { url: string; title: string }`, `TextResult.citations?: Citation[]`.

- [ ] Tests: `sends the web plugin when web search is requested` (body has `plugins: [{ id: 'web', max_results: 8 }]`), `reads url citations from annotations` (keeps http/https, drops `javascript:`, deduplicates), `leaves requests without web search unchanged` (no `plugins` key).
- [ ] Run, see them fail, implement, run `pnpm test -- packages/providers`, commit.

### Task 2: Brand DNA fields and stored DNA upgrade

**Files:** modify `packages/core/src/brand-dna/brand-dna-schema.ts`, `brand-dna-repository.ts`, `brand-dna-prompts.ts`, `packages/core/src/models/fake-responses.ts`; test `packages/core/test/brand-dna/brand-dna.test.ts`, `packages/core/test/brand-dna/dna-feedback.integration.test.ts`

**Produces:** `competitorSchema`, `Competitor`, `identity.features`, `audience.channels`, `upgradeStoredDna(data: unknown): unknown`.

- [ ] Tests: `upgrades name-only competitors and missing lists` (`'Acme'` → full record with empty fields), integration test where a raw v0.1 row is read through `getBrandDna`.
- [ ] Implement. `upgradeStoredDna` runs before `dropInvalidPalette`. Prompt drops "Leave competitors empty unless the pages name them" and asks for features and channels.
- [ ] `pnpm typecheck`, fix the DNA form to compile with competitor records (rendered names only for now), run tests, commit.

### Task 3: Research table and repository

**Files:** modify `packages/db/src/schema/brands.ts`, add generated migration; create `packages/core/src/research/research-schema.ts`, `research-repository.ts`; test `packages/core/test/research/research-repository.integration.test.ts`

**Produces:** `brandResearch` table; `researchFindingsSchema`; `BrandResearch = { status; brief; sources; findings; researchedAt; attemptedAt }`; `saveResearch(db, brandId, { brief, sources, findings })`, `recordFailedResearch(db, brandId)`, `getResearch(db, brandId): Promise<BrandResearch | null>`.

- [ ] Tests: save then load, failed attempt keeps the previous findings and `researchedAt`, failed attempt with no prior row stores empty brief.
- [ ] `pnpm db:generate`, implement, run, commit.

### Task 4: Research pipeline in core

**Files:** create `packages/core/src/research/research-prompts.ts`, `research-brand.ts`, `verify-competitors.ts`, `apply-research.ts`; modify fake responses and fake models; tests in `packages/core/test/research/`

**Produces:** `researchBrand(brain, modelId, { url, crawl, today, allowPrivateHosts }): Promise<{ brief; sources; findings; usage: Usage[] }>`, `verifyCompetitors(competitors, { ownOrigin, allowPrivateHosts }): Promise<Competitor[]>`, `applyResearch(dna, findings): BrandDna`.

- [ ] Tests: prompt wraps pages as untrusted and states the date, uncited `sourceUrls` removed, more than five competitors cut to five, own-site competitor dropped, brief without citations still yields findings, verification keeps a reachable local server and drops a 404 and a private address when private hosts are blocked, `applyResearch` keeps voice and visuals and fills an empty name only.
- [ ] Fake brain returns a brief with citations for web-search requests and fixed findings for `brand_research`, with competitors that have no URL.
- [ ] Implement, run, commit.

### Task 5: Worker jobs

**Files:** create `apps/worker/src/jobs/brand-research.ts`; modify `brand-crawl.ts`, `brand-synthesize-dna.ts`, `register-jobs.ts`, `packages/core/src/jobs/job-names.ts`, `job-payloads.ts`, `packages/core/src/brands/brand-repository.ts`; test `apps/worker/test/brand-jobs.integration.test.ts`

**Produces:** job `brand.research` with payload `{ brandId, refresh?: boolean }`; `setBrandName(db, brandId, name)`.

- [ ] Tests: crawl enqueues research, research enqueues synthesis and stores sources, synthesis applies findings and renames the brand, a provider error records failed research and still enqueues synthesis, refresh updates competitors and keeps voice, refresh re-applies after a version change, failed refresh leaves the DNA untouched.
- [ ] Implement, run integration tests, commit.

### Task 6: Web app

**Files:** modify `apps/web/src/features/brands/new-brand-form.tsx`, `onboarding-progress.tsx`, `features/brand-dna/dna-form.tsx`, `dna-service.ts`, `actions.ts`, the DNA page; create `features/brand-dna/competitors-field.tsx`, `research-panel.tsx`; test `apps/web/test/brand-dna-actions.integration.test.ts`

**Produces:** `requestResearchRefresh(context, brandId): Promise<DnaResult>`, `refreshResearchAction(brandId)`.

- [ ] Tests: viewers are refused, editors queue one job for two calls, saving DNA renames the brand.
- [ ] Form: website mode with a required URL, toggle to manual mode with a brand name.
- [ ] Implement UI, run integration tests and typecheck, commit.

### Task 7: End to end and README

**Files:** modify `apps/web/e2e/flows.ts`, `golden-path.spec.ts`, `error-states.spec.ts` if it uses the old form, `README.md`

- [ ] Flow fills only the website, asserts the discovered name and a competitor card and the research panel.
- [ ] README: onboarding sentence and the web search cost note.
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:integration`, `pnpm e2e`, commit.
