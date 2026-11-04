'use client';

import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createBrandAction } from './actions';

type FieldErrors = { name?: string; url?: string };

export function NewBrandForm() {
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [failed, setFailed] = useState(false);
  const [pending, setPending] = useState(false);

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
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="brand-name">Brand name</Label>
        <Input
          id="brand-name"
          name="name"
          maxLength={200}
          aria-invalid={fieldErrors.name ? true : undefined}
          aria-describedby="brand-name-error"
        />
        <p id="brand-name-error" role="alert" className="min-h-5 text-sm text-danger">
          {fieldErrors.name}
        </p>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="brand-url">Website (optional)</Label>
        <Input
          id="brand-url"
          name="url"
          type="url"
          inputMode="url"
          placeholder="https://example.com"
          maxLength={2048}
          aria-invalid={fieldErrors.url ? true : undefined}
          aria-describedby="brand-url-help brand-url-error"
        />
        <p id="brand-url-help" className="text-sm text-muted">
          Lumo reads your site to learn your brand. Leave it empty to describe your brand yourself.
        </p>
        <p id="brand-url-error" role="alert" className="min-h-5 text-sm text-danger">
          {fieldErrors.url}
        </p>
      </div>
      {failed && (
        <p role="alert" className="text-sm text-danger">
          Something went wrong. Try again.
        </p>
      )}
      <Button type="submit" disabled={pending} className="self-start">
        {pending ? 'Creating...' : 'Create brand'}
      </Button>
    </form>
  );
}
