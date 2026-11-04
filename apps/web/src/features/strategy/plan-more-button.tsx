'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { planMoreAction } from './actions';

const genericError = 'Something went wrong. Try again.';

export function PlanMoreButton({ brandId }: { brandId: string }) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function planMore() {
    setPending(true);
    setMessage(null);
    try {
      const result = await planMoreAction(brandId);
      if (!result.ok) {
        setMessage(result.error === 'already_planned' ? "You're already planned two weeks ahead." : genericError);
      }
    } catch {
      setMessage(genericError);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <Button type="button" onClick={planMore} disabled={pending}>
        Plan more
      </Button>
      <p role="status" className="text-sm text-muted">
        {message}
      </p>
    </div>
  );
}
