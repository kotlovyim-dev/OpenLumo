import type { ReactNode } from 'react';

export type SpotName = 'setup-welcome' | 'reading-site' | 'needs-input' | 'empty-board' | 'exported' | 'not-found';

export function EmptyState({
  spot,
  title,
  description,
  action,
}: {
  spot: SpotName;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <section className="mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-12 text-center">
      <img src={`/brand/spots/${spot}.svg`} alt="" width={240} height={200} className="h-auto w-52" />
      <div className="flex flex-col gap-2">
        <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
        <p className="text-sm text-muted">{description}</p>
      </div>
      {action}
    </section>
  );
}
