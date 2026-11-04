'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { authClient } from '@/lib/auth-client';

type Mode = 'sign-in' | 'sign-up';

const copy = {
  'sign-in': {
    title: 'Welcome back',
    action: 'Sign in',
    alternate: { text: 'New to OpenLumo?', label: 'Create an account', href: '/sign-up' },
    password: 'current-password',
  },
  'sign-up': {
    title: 'Create your account',
    action: 'Create account',
    alternate: { text: 'Already have an account?', label: 'Sign in', href: '/sign-in' },
    password: 'new-password',
  },
} as const;

export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const text = copy[mode];

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get('email'));
    const password = String(form.get('password'));
    setPending(true);
    setError(null);
    const result =
      mode === 'sign-up'
        ? await authClient.signUp.email({ name: String(form.get('name')), email, password })
        : await authClient.signIn.email({ email, password });
    setPending(false);
    if (result.error) {
      setError(result.error.message ?? 'Something went wrong. Try again.');
      return;
    }
    router.push('/');
    router.refresh();
  }

  return (
    <Card className="w-full max-w-sm">
      <h1 className="text-2xl font-bold tracking-tight">{text.title}</h1>
      <form onSubmit={submit} className="mt-6 flex flex-col gap-4">
        {mode === 'sign-up' && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name">Name</Label>
            <Input id="name" name="name" autoComplete="name" required />
          </div>
        )}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" autoComplete="email" required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="password">Password</Label>
          <Input id="password" name="password" type="password" autoComplete={text.password} minLength={8} required />
        </div>
        <p role="alert" className="min-h-5 text-sm text-danger">
          {error}
        </p>
        <Button type="submit" disabled={pending}>
          {pending ? 'One moment...' : text.action}
        </Button>
      </form>
      <p className="mt-6 text-sm text-muted">
        {text.alternate.text}{' '}
        <Link href={text.alternate.href} className="font-semibold text-lilac underline-offset-4 hover:underline">
          {text.alternate.label}
        </Link>
      </p>
    </Card>
  );
}
