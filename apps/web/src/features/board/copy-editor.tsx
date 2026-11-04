'use client';

import { Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

export type CopyValue = string | CopyValue[] | { [key: string]: CopyValue };

type FieldProps = {
  path: string;
  name: string;
  label: string;
  value: CopyValue;
  onChange: (value: CopyValue) => void;
  errors: Record<string, string>;
  readOnly: boolean;
};

const fieldOrder = [
  'slides',
  'title',
  'text',
  'headline',
  'primaryText',
  'callToAction',
  'caption',
  'hashtags',
  'imageBrief',
  'prompt',
  'headlineOverlay',
  'subject',
  'preheader',
  'body',
  'seoTitle',
  'metaDescription',
  'outline',
  'article',
  'faq',
  'question',
  'answer',
];

const labelOverrides: Record<string, string> = { seoTitle: 'SEO title', faq: 'FAQ' };
const entryLabels: Record<string, string> = { slides: 'Slide', faq: 'Question', hashtags: 'Hashtag', outline: 'Outline point' };
const entryTemplates: Record<string, CopyValue> = {
  slides: { title: '', text: '', imageBrief: { prompt: '' } },
  faq: { question: '', answer: '' },
};

function fieldLabel(key: string) {
  const words = key.replace(/([A-Z])/g, ' $1').toLowerCase();
  return labelOverrides[key] ?? words.charAt(0).toUpperCase() + words.slice(1);
}

function blank(value: CopyValue): CopyValue {
  if (typeof value === 'string') return '';
  if (Array.isArray(value)) return [];
  return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, blank(entry)]));
}

function ErrorText({ id, error }: { id: string; error?: string }) {
  if (!error) return null;
  return (
    <p id={`${id}-error`} role="alert" className="text-xs text-danger">
      {error}
    </p>
  );
}

function CopyField({ path, name, label, value, onChange, errors, readOnly }: FieldProps) {
  const id = `copy-${path || 'root'}`;
  const error = errors[path];

  if (typeof value === 'string') {
    return (
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={id}>{label}</Label>
        <Textarea
          id={id}
          value={value}
          readOnly={readOnly}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          onChange={(event) => onChange(event.target.value)}
        />
        <ErrorText id={id} error={error} />
      </div>
    );
  }

  if (Array.isArray(value)) {
    const entryLabel = entryLabels[name] ?? 'Entry';
    const template = value[0] === undefined ? (entryTemplates[name] ?? '') : blank(value[0]);
    return (
      <fieldset className="flex flex-col gap-3" aria-describedby={error ? `${id}-error` : undefined}>
        <legend className="mb-1 text-sm font-semibold">{label}</legend>
        {value.map((entry, index) => (
          <div key={index} className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <CopyField
                path={`${path}.${index}`}
                name={name}
                label={`${entryLabel} ${index + 1}`}
                value={entry}
                onChange={(next) => onChange(value.map((current, position) => (position === index ? next : current)))}
                errors={errors}
                readOnly={readOnly}
              />
            </div>
            {!readOnly && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="mt-6 shrink-0"
                aria-label={`Remove ${entryLabel.toLowerCase()} ${index + 1}`}
                onClick={() => onChange(value.filter((_, position) => position !== index))}
              >
                <X className="size-4" aria-hidden="true" />
              </Button>
            )}
          </div>
        ))}
        {!readOnly && (
          <Button type="button" variant="outline" className="self-start" onClick={() => onChange([...value, template])}>
            <Plus className="size-4" aria-hidden="true" />
            Add {entryLabel.toLowerCase()}
          </Button>
        )}
        <ErrorText id={id} error={error} />
      </fieldset>
    );
  }

  const ordered = Object.entries(value).sort(([a], [b]) => fieldOrder.indexOf(a) - fieldOrder.indexOf(b));
  const fields = ordered.map(([key, entry]) => (
    <CopyField
      key={key}
      path={path ? `${path}.${key}` : key}
      name={key}
      label={fieldLabel(key)}
      value={entry}
      onChange={(next) => onChange({ ...value, [key]: next })}
      errors={errors}
      readOnly={readOnly}
    />
  ));
  if (!label) return <div className="flex flex-col gap-4">{fields}</div>;
  return (
    <fieldset className="flex flex-col gap-4 rounded-control border border-border p-3">
      <legend className="px-1 text-sm font-semibold">{label}</legend>
      {fields}
    </fieldset>
  );
}

export function CopyEditor({
  value,
  onChange,
  errors,
  readOnly,
}: {
  value: CopyValue;
  onChange: (value: CopyValue) => void;
  errors: Record<string, string>;
  readOnly: boolean;
}) {
  return <CopyField path="" name="" label="" value={value} onChange={onChange} errors={errors} readOnly={readOnly} />;
}
