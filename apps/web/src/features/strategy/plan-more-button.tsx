'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { planMoreAction } from './actions';

export function PlanMoreButton({ brandId }: { brandId: string }) {
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  async function planMore() {
    setPending(true);
    setFailed(false);
    try {
      const result = await planMoreAction(brandId);
      if (!result.ok) setFailed(true);
    } catch {
      setFailed(true);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <Button type="button" onClick={planMore} disabled={pending}>
        Plan more
      </Button>
      {failed && (
        <p role="alert" className="text-sm text-danger">
          Something went wrong. Try again.
        </p>
      )}
    </div>
  );
}
