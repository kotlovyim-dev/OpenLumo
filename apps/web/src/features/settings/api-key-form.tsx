'use client';

import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { saveApiKey } from './actions';

const messages: Record<string, string> = {
  unauthorized: 'OpenRouter did not accept that key. Check it and try again.',
  invalid_key: 'Enter your OpenRouter API key.',
  forbidden: 'Only an admin can change the API key.',
};

export function ApiKeyForm({ submitLabel, onSaved }: { submitLabel: string; onSaved: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setPending(true);
    setError(null);
    try {
      const result = await saveApiKey(new FormData(form));
      if (!result.ok) {
        setError(messages[result.error] ?? 'Something went wrong. Try again.');
        return;
      }
      form.reset();
      onSaved();
    } catch {
      setError('Something went wrong. Try again.');
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="apiKey">OpenRouter API key</Label>
        <Input
          id="apiKey"
          name="apiKey"
          type="password"
          autoComplete="off"
          required
          aria-invalid={error ? true : undefined}
          aria-describedby="api-key-error"
        />
      </div>
      <p id="api-key-error" role="alert" className="min-h-5 text-sm text-danger">
        {error}
      </p>
      <Button type="submit" disabled={pending} className="self-start">
        {pending ? 'Checking key...' : submitLabel}
      </Button>
    </form>
  );
}
