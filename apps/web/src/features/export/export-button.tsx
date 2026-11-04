'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Download, Package } from 'lucide-react';
import { EmptyState } from '@/components/empty-state';
import { Button, buttonVariants } from '@/components/ui/button';
import { useJobEvents } from '@/hooks/use-job-events';
import { exportItems, getExportRun } from './actions';

type ExportState =
  | { phase: 'idle' }
  | { phase: 'starting' }
  | { phase: 'waiting'; runId: string }
  | { phase: 'ready'; assetId: string }
  | { phase: 'error'; message: string };

const messages = {
  invalid_items: 'Only approved or scheduled items can be exported.',
  failed: 'The export failed. Try again.',
  generic: 'Something went wrong. Try again.',
};

export function ExportButton({ brandId, itemIds, label }: { brandId: string; itemIds: string[]; label: string }) {
  const router = useRouter();
  const [state, setState] = useState<ExportState>({ phase: 'idle' });

  async function start() {
    setState({ phase: 'starting' });
    try {
      const result = await exportItems(brandId, itemIds);
      setState(result.ok ? { phase: 'waiting', runId: result.runId } : { phase: 'error', message: messages[result.error] });
    } catch {
      setState({ phase: 'error', message: messages.generic });
    }
  }

  function finish(next: ExportState) {
    setState(next);
    router.refresh();
  }

  const busy = state.phase === 'starting' || state.phase === 'waiting';

  return (
    <div className="flex flex-col gap-3">
      <Button type="button" variant="outline" className="self-start" disabled={busy || itemIds.length === 0} onClick={start}>
        <Package className="size-4" aria-hidden="true" />
        {busy ? 'Packing export…' : label}
      </Button>
      {state.phase === 'waiting' && <ExportWaiter brandId={brandId} runId={state.runId} onDone={finish} />}
      <p role="status" aria-live="polite" className="text-sm text-danger empty:hidden">
        {state.phase === 'error' ? state.message : ''}
      </p>
      {state.phase === 'ready' && (
        <EmptyState
          spot="exported"
          title="Your export is ready"
          description="The ZIP holds the copy, images and a calendar file for every item."
          action={
            <a href={`/api/assets/${state.assetId}`} download className={buttonVariants()}>
              <Download className="size-4" aria-hidden="true" />
              Download ZIP
            </a>
          }
        />
      )}
    </div>
  );
}

function ExportWaiter({
  brandId,
  runId,
  onDone,
}: {
  brandId: string;
  runId: string;
  onDone: (state: ExportState) => void;
}) {
  async function check() {
    try {
      const run = await getExportRun(brandId, runId);
      if (run.status === 'succeeded' && run.resultAssetId) onDone({ phase: 'ready', assetId: run.resultAssetId });
      if (run.status === 'failed') onDone({ phase: 'error', message: messages.failed });
    } catch {
      onDone({ phase: 'error', message: messages.generic });
    }
  }

  useJobEvents(
    brandId,
    (event) => {
      if (event.runId === runId && (event.status === 'succeeded' || event.status === 'failed')) void check();
    },
    () => void check(),
  );

  return null;
}
