'use client';

import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { inviteMemberAction } from './actions';

const messages: Record<string, string> = {
  user_not_found: 'No account uses that email yet. Ask them to sign up first.',
  invalid_input: 'Enter a valid email address.',
  already_member: 'That person is already a member of this brand.',
  forbidden: 'Only a brand owner can invite people.',
};

export function InviteMember({ brandId }: { brandId: string }) {
  const [message, setMessage] = useState<{ tone: 'error' | 'success'; text: string } | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setPending(true);
    setMessage(null);
    try {
      const result = await inviteMemberAction(brandId, new FormData(form));
      if (result.ok) {
        form.reset();
        setMessage({ tone: 'success', text: 'Member added.' });
      } else {
        setMessage({ tone: 'error', text: messages[result.error] ?? 'Something went wrong. Try again.' });
      }
    } catch {
      setMessage({ tone: 'error', text: 'Something went wrong. Try again.' });
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex max-w-md flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="invite-email">Email of an existing user</Label>
        <Input id="invite-email" name="email" type="email" required autoComplete="off" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="invite-role">Role</Label>
        <select
          id="invite-role"
          name="role"
          defaultValue="editor"
          className="h-10 w-full rounded-control border border-border bg-background px-3 text-sm"
        >
          <option value="editor">Editor</option>
          <option value="viewer">Viewer</option>
        </select>
      </div>
      <p role="status" className={`min-h-5 text-sm ${message?.tone === 'error' ? 'text-danger' : 'text-muted'}`}>
        {message?.text}
      </p>
      <Button type="submit" disabled={pending} className="self-start">
        {pending ? 'Adding...' : 'Add member'}
      </Button>
    </form>
  );
}
