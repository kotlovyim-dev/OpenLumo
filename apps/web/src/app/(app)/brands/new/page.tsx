import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'New brand' };

export default function Page() {
  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-bold tracking-tight">Create your first brand</h1>
      <p className="mt-2 text-muted">Brand setup is coming soon.</p>
    </div>
  );
}
