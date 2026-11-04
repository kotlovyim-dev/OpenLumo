'use client';

import { useEffect, useId, useMemo, useState, type KeyboardEvent } from 'react';
import type { ModelCapability } from '@openlumo/core';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { listAvailableModels, saveModelChoice } from './actions';
import type { ModelOption } from './settings-service';

const labels: Record<ModelCapability, string> = { brain: 'Brain model', image: 'Image model' };

function formatPrice(model: ModelOption) {
  return model.pricePerMillionInputTokens === undefined
    ? null
    : `$${model.pricePerMillionInputTokens} / M input tokens`;
}

export function ModelPicker({
  capability,
  currentModel,
  submitLabel = 'Save model',
  reloadKey = 0,
  onSaved,
}: {
  capability: ModelCapability;
  currentModel: string | null;
  submitLabel?: string;
  reloadKey?: number;
  onSaved: () => void;
}) {
  const id = useId();
  const listId = `${id}-list`;
  const [models, setModels] = useState<ModelOption[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [selected, setSelected] = useState<string | null>(currentModel);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setModels(null);
    setLoadError(null);
    listAvailableModels(capability)
      .then((result) => {
        if (cancelled) return;
        if (result.ok) setModels(result.models);
        else setLoadError(result.error === 'no_api_key' ? 'Add your API key first.' : "Couldn't load models. Try again.");
      })
      .catch(() => {
        if (!cancelled) setLoadError("Couldn't load models. Try again.");
      });
    return () => {
      cancelled = true;
    };
  }, [capability, attempt, reloadKey]);

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (models ?? []).filter(
      (model) => model.name.toLowerCase().includes(needle) || model.id.toLowerCase().includes(needle),
    );
  }, [models, query]);

  function choose(model: ModelOption) {
    setSelected(model.id);
    setQuery('');
    setOpen(false);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setOpen(true);
      setActive((index) => Math.max(0, Math.min(index + 1, matches.length - 1)));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((index) => Math.max(index - 1, 0));
    } else if (event.key === 'Enter' && open && matches[active]) {
      event.preventDefault();
      choose(matches[active]);
    } else if (event.key === 'Escape') {
      setOpen(false);
    }
  }

  async function save() {
    if (!selected) return;
    setPending(true);
    setError(null);
    try {
      const result = await saveModelChoice(capability, selected);
      if (!result.ok) {
        setError(result.error === 'forbidden' ? 'Only an admin can change models.' : 'Could not save the model.');
        return;
      }
      onSaved();
    } catch {
      setError('Could not save the model.');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="relative flex flex-col gap-1.5">
        <Label htmlFor={id}>{labels[capability]}</Label>
        <Input
          id={id}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && matches[active] ? `${id}-option-${active}` : undefined}
          autoComplete="off"
          placeholder={models ? 'Search models' : 'Loading models...'}
          disabled={!models}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setActive(0);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={onKeyDown}
        />
        <ul
          id={listId}
          role="listbox"
          aria-label={labels[capability]}
          hidden={!open}
          className="absolute top-full z-10 mt-1 max-h-64 w-full overflow-y-auto rounded-control border border-border bg-elevated py-1 shadow-lg"
        >
          {matches.length === 0 && <li className="px-3 py-2 text-sm text-muted">No models match.</li>}
          {matches.map((model, index) => (
            <li
              key={model.id}
              id={`${id}-option-${index}`}
              role="option"
              aria-selected={model.id === selected}
              onMouseDown={(event) => {
                event.preventDefault();
                choose(model);
              }}
              className={cn('cursor-pointer px-3 py-2 text-sm', index === active && 'bg-surface')}
            >
              <span className="font-medium">{model.name}</span>
              <span className="block text-xs text-muted">
                {model.id}
                {formatPrice(model) && ` · ${formatPrice(model)}`}
              </span>
            </li>
          ))}
        </ul>
      </div>
      <p className="text-sm text-muted">{selected ? `Selected: ${selected}` : 'No model selected yet.'}</p>
      <p role="alert" className="min-h-5 text-sm text-danger">
        {loadError ?? error}
      </p>
      {loadError && loadError !== 'Add your API key first.' && (
        <Button type="button" variant="outline" onClick={() => setAttempt((count) => count + 1)} className="self-start">
          Retry
        </Button>
      )}
      <Button type="button" onClick={save} disabled={!selected || pending} className="self-start">
        {pending ? 'Saving...' : submitLabel}
      </Button>
    </div>
  );
}
