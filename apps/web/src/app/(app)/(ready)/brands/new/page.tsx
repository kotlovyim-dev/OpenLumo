import type { Metadata } from 'next';
import { NewBrandForm } from '@/features/brands/new-brand-form';
import { getServerContext } from '@/lib/server-context';

export const metadata: Metadata = { title: 'New brand' };

export default async function Page() {
  await getServerContext();
  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">Create a brand</h1>
      <p className="mb-6 mt-2 text-muted">Paste your website and Lumo does the research. You can refine everything afterwards.</p>
      <NewBrandForm />
    </div>
  );
}
