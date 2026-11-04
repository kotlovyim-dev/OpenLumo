'use client';

import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { HEX_COLOR } from './hex-color';



type FieldProps = { id: string; label: string; error?: string; readOnly: boolean };

function ErrorText({ id, error }: { id: string; error?: string }) {
  return (
    <p id={`${id}-error`} role={error ? 'alert' : undefined} className="min-h-4 text-xs text-danger">
      {error}
    </p>
  );
}

export function TextField({
  id,
  label,
  value,
  onChange,
  error,
  readOnly,
  multiline,
}: FieldProps & { value: string; onChange: (value: string) => void; multiline?: boolean }) {
  const shared = {
    id,
    value,
    readOnly,
    'aria-invalid': error ? true : undefined,
    'aria-describedby': `${id}-error`,
    onChange: (event: { target: { value: string } }) => onChange(event.target.value),
  };
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {multiline ? (
        <textarea
          {...shared}
          rows={3}
          className="w-full rounded-control border border-border bg-background px-3 py-2 text-sm text-foreground"
        />
      ) : (
        <Input {...shared} />
      )}
      <ErrorText id={id} error={error} />
    </div>
  );
}

export function ChipsField({
  id,
  label,
  values,
  onChange,
  error,
  readOnly,
}: FieldProps & { values: string[]; onChange: (values: string[]) => void }) {
  const [draft, setDraft] = useState('');

  function add() {
    const entry = draft.trim();
    if (!entry || values.includes(entry)) return;
    onChange([...values, entry]);
    setDraft('');
  }

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {values.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {values.map((value) => (
            <li
              key={value}
              className="flex items-center gap-1 rounded-control border border-border bg-elevated py-1 pl-3 pr-1 text-sm"
            >
              <span>{value}</span>
              {!readOnly && (
                <button
                  type="button"
                  aria-label={`Remove ${value}`}
                  onClick={() => onChange(values.filter((entry) => entry !== value))}
                  className="rounded-control p-1 text-muted hover:text-foreground"
                >
                  <X className="size-3.5" aria-hidden />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {!readOnly && (
        <div className="flex gap-2">
          <Input
            id={id}
            value={draft}
            aria-describedby={`${id}-error`}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== 'Enter') return;
              event.preventDefault();
              add();
            }}
          />
          <Button type="button" variant="outline" onClick={add}>
            <Plus className="size-4" aria-hidden />
            Add
          </Button>
        </div>
      )}
      <ErrorText id={id} error={error} />
    </div>
  );
}

export function ToneField({
  id,
  label,
  low,
  high,
  value,
  onChange,
  error,
  readOnly,
}: FieldProps & { low: string; high: string; value: number; onChange: (value: number) => void }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex items-center gap-3 text-sm text-muted">
        <span className="w-20 text-right">{low}</span>
        <input
          id={id}
          type="range"
          min={0}
          max={10}
          step={1}
          value={value}
          disabled={readOnly}
          aria-valuetext={`${value} of 10, from ${low} to ${high}`}
          aria-describedby={`${id}-error`}
          onChange={(event) => onChange(Number(event.target.value))}
          className="flex-1 accent-violet"
        />
        <span className="w-20">{high}</span>
        <span className="w-6 tabular-nums text-foreground">{value}</span>
      </div>
      <ErrorText id={id} error={error} />
    </div>
  );
}

export function PaletteField({
  id,
  label,
  values,
  onChange,
  errors,
  readOnly,
}: {
  id: string;
  label: string;
  values: string[];
  onChange: (values: string[]) => void;
  errors: Record<number, string>;
  readOnly: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={`${id}-0`}>{label}</Label>
      <ul className="flex flex-col gap-2">
        {values.map((value, index) => {
          const invalid = !HEX_COLOR.test(value);
          const message = errors[index] ?? (invalid ? 'Use a hex colour like #1a2b3c.' : undefined);
          return (
            <li key={index} className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <span
                  aria-hidden
                  className="size-10 shrink-0 rounded-control border border-border"
                  style={{ backgroundColor: invalid ? 'transparent' : value }}
                />
                <Input
                  id={`${id}-${index}`}
                  value={value}
                  readOnly={readOnly}
                  aria-invalid={message ? true : undefined}
                  aria-describedby={`${id}-${index}-error`}
                  onChange={(event) => onChange(values.map((entry, at) => (at === index ? event.target.value.toLowerCase() : entry)))}
                  className="max-w-40 font-mono"
                />
                {!readOnly && (
                  <button
                    type="button"
                    aria-label={`Remove ${value || 'colour'}`}
                    onClick={() => onChange(values.filter((_, at) => at !== index))}
                    className="rounded-control p-2 text-muted hover:text-foreground"
                  >
                    <X className="size-4" aria-hidden />
                  </button>
                )}
              </div>
              <ErrorText id={`${id}-${index}`} error={message} />
            </li>
          );
        })}
      </ul>
      {!readOnly && (
        <Button type="button" variant="outline" className="self-start" onClick={() => onChange([...values, '#'])}>
          <Plus className="size-4" aria-hidden />
          Add colour
        </Button>
      )}
    </div>
  );
}
