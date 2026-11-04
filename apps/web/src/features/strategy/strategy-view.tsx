import type { StrategyDocument } from '@openlumo/core';
import { Card } from '@/components/ui/card';
import { channelDotClasses, channelLabels } from './channel-style';

function ListCard({ title, items }: { title: string; items: string[] }) {
  return (
    <Card className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      <ul className="flex list-disc flex-col gap-1.5 pl-5 text-sm">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </Card>
  );
}

export function StrategyView({ document }: { document: StrategyDocument }) {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-6 md:grid-cols-2">
        <ListCard title="Strengths" items={document.strengths} />
        <ListCard title="Gaps" items={document.gaps} />
      </div>
      <Card className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold tracking-tight">Content pillars</h2>
        <dl className="grid gap-4 sm:grid-cols-2">
          {document.pillars.map((pillar) => (
            <div key={pillar.name}>
              <dt className="text-sm font-semibold">{pillar.name}</dt>
              <dd className="text-sm text-muted">{pillar.description}</dd>
            </div>
          ))}
        </dl>
      </Card>
      <Card className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold tracking-tight">Cadence</h2>
        <ul className="flex flex-wrap gap-3">
          {document.cadence.map(({ channel, postsPerWeek }) => (
            <li key={channel} className="flex items-center gap-2 rounded-control border border-border px-3 py-2 text-sm">
              <span aria-hidden className={`size-2.5 rounded-full ${channelDotClasses[channel]}`} />
              {channelLabels[channel]}
              <span className="text-muted">{postsPerWeek} per week</span>
            </li>
          ))}
        </ul>
      </Card>
      <Card className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold tracking-tight">Campaign ideas</h2>
        <ul className="grid gap-4 md:grid-cols-3">
          {document.campaignIdeas.map((idea) => (
            <li key={idea.title} className="rounded-control border border-border bg-elevated p-4">
              <p className="text-sm font-semibold">{idea.title}</p>
              <p className="mt-1 text-sm text-muted">{idea.summary}</p>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
