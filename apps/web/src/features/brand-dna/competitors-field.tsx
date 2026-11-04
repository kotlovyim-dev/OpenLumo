'use client';

import { Plus, X } from 'lucide-react';
import type { Competitor } from '@openlumo/core';
import { Button } from '@/components/ui/button';
import { ChipsField, TextField } from './dna-fields';

const emptyCompetitor: Competitor = { name: '', url: '', positioning: '', strengths: [], weaknesses: [], sourceUrls: [] };

function isWebAddress(value: string) {
  try {
    return ['http:', 'https:'].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

function hostnameOf(url: string) {
  return new URL(url).hostname.replace(/^www\./, '');
}

export function CompetitorsField({
  values,
  onChange,
  errorFor,
  readOnly,
}: {
  values: Competitor[];
  onChange: (values: Competitor[]) => void;
  errorFor: (id: string) => string | undefined;
  readOnly: boolean;
}) {
  const update = (index: number, changes: Partial<Competitor>) =>
    onChange(values.map((competitor, at) => (at === index ? { ...competitor, ...changes } : competitor)));

  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-sm font-medium">Competitors</h3>
      {values.length === 0 && <p className="text-sm text-muted">No competitors yet.</p>}
      <ul className="flex flex-col gap-3">
        {values.map((competitor, index) => {
          const id = `competitors.${index}`;
          const sources = competitor.sourceUrls.filter(isWebAddress);
          return (
            <li key={index} className="flex flex-col gap-3 rounded-control border border-border bg-elevated p-4">
              <div className="flex items-start justify-between gap-3">
                <p className="font-medium">{competitor.name || 'New competitor'}</p>
                {!readOnly && (
                  <button
                    type="button"
                    aria-label={`Remove ${competitor.name || 'competitor'}`}
                    onClick={() => onChange(values.filter((_, at) => at !== index))}
                    className="rounded-control p-1 text-muted hover:text-foreground"
                  >
                    <X className="size-4" aria-hidden />
                  </button>
                )}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <TextField id={`${id}.name`} label="Name" value={competitor.name} onChange={(name) => update(index, { name })} error={errorFor(`${id}.name`)} readOnly={readOnly} />
                <TextField id={`${id}.url`} label="Website" value={competitor.url} onChange={(url) => update(index, { url })} error={errorFor(`${id}.url`)} readOnly={readOnly} />
              </div>
              <TextField id={`${id}.positioning`} label="Positioning" value={competitor.positioning} onChange={(positioning) => update(index, { positioning })} error={errorFor(`${id}.positioning`)} readOnly={readOnly} multiline />
              <ChipsField id={`${id}.strengths`} label="Strengths" values={competitor.strengths} onChange={(strengths) => update(index, { strengths })} error={errorFor(`${id}.strengths`)} readOnly={readOnly} />
              <ChipsField id={`${id}.weaknesses`} label="Weaknesses" values={competitor.weaknesses} onChange={(weaknesses) => update(index, { weaknesses })} error={errorFor(`${id}.weaknesses`)} readOnly={readOnly} />
              {sources.length > 0 && (
                <p className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
                  <span>Sources:</span>
                  {sources.map((url) => (
                    <a key={url} href={url} target="_blank" rel="noreferrer noopener" className="underline underline-offset-2 hover:text-foreground">
                      {hostnameOf(url)}
                    </a>
                  ))}
                </p>
              )}
            </li>
          );
        })}
      </ul>
      {!readOnly && (
        <Button type="button" variant="outline" className="self-start" onClick={() => onChange([...values, emptyCompetitor])}>
          <Plus className="size-4" aria-hidden />
          Add competitor
        </Button>
      )}
    </div>
  );
}
