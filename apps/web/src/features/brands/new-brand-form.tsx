'use client';

import { LoaderCircle } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createBrandAction } from './actions';
import { OnboardingSteps } from './onboarding-steps';

type FieldErrors = { name?: string; url?: string };

type Mode = 'website' | 'manual';

export function NewBrandForm() {
  const [mode, setMode] = useState<Mode>('website');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [failed, setFailed] = useState(false);
  const [pending, setPending] = useState(false);

  function switchTo(next: Mode) {
    setMode(next);
    setFieldErrors({});
    setFailed(false);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setFieldErrors({});
    setFailed(false);
    try {
      const result = await createBrandAction(new FormData(event.currentTarget));
      if (result && !result.ok) setFieldErrors(result.fieldErrors);
    } catch {
      setFailed(true);
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex max-w-xl flex-col gap-4">
      {mode === 'website' ? (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="brand-url">Website</Label>
          <Input
            id="brand-url"
            name="url"
            type="url"
            inputMode="url"
            required
            autoFocus
            placeholder="https://example.com"
            maxLength={2048}
            aria-invalid={fieldErrors.url ? true : undefined}
            aria-describedby="brand-url-help brand-url-error"
          />
          <p id="brand-url-help" className="text-sm text-muted">
            Paste a link. Lumo reads your site and researches the web for your name, features, audience and competitors.
          </p>
          <p id="brand-url-error" role="alert" className="min-h-5 text-sm text-danger">
            {fieldErrors.url}
          </p>
          <div className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4">
            <p className="text-sm font-semibold">What happens next</p>
            <OnboardingSteps current={-1} />
            <p className="text-xs text-muted">Usually a minute or two. You can review and change everything afterwards.</p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="brand-name">Brand name</Label>
          <Input
            id="brand-name"
            name="name"
            required
            autoFocus
            maxLength={200}
            aria-invalid={fieldErrors.name ? true : undefined}
            aria-describedby="brand-name-help brand-name-error"
          />
          <p id="brand-name-help" className="text-sm text-muted">
            You will describe your brand yourself on the next page.
          </p>
          <p id="brand-name-error" role="alert" className="min-h-5 text-sm text-danger">
            {fieldErrors.name}
          </p>
        </div>
      )}
      {failed && (
        <p role="alert" className="text-sm text-danger">
          Something went wrong. Try again.
        </p>
      )}
      <div className="flex flex-wrap items-center gap-4">
        <Button type="submit" disabled={pending}>
          {pending && <LoaderCircle className="size-4 animate-spin" aria-hidden />}
          {pending ? (mode === 'website' ? 'Starting research...' : 'Creating...') : 'Create brand'}
        </Button>
        <button
          type="button"
          onClick={() => switchTo(mode === 'website' ? 'manual' : 'website')}
          className="text-sm text-muted underline-offset-4 hover:text-foreground hover:underline"
        >
          {mode === 'website' ? 'No website? Describe your brand yourself' : 'Use a website instead'}
        </button>
      </div>
    </form>
  );
}
