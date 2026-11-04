'use client';

import { useState } from 'react';
import { Copy, ImageDown } from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import { ExportButton } from '../export/export-button';

export function ItemExport({
  brandId,
  itemId,
  text,
  assetIds,
  canExport,
  exportable,
}: {
  brandId: string;
  itemId: string;
  text: string | null;
  assetIds: string[];
  canExport: boolean;
  exportable: boolean;
}) {
  const [copied, setCopied] = useState<boolean | null>(null);

  async function copyText() {
    try {
      await navigator.clipboard.writeText(text ?? '');
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <section aria-labelledby="export-heading" className="flex flex-col gap-3">
      <h3 id="export-heading" className="text-sm font-semibold">
        Export
      </h3>
      <div className="flex flex-wrap gap-2">
        {text && (
          <Button type="button" variant="outline" onClick={copyText}>
            <Copy className="size-4" aria-hidden="true" />
            Copy text
          </Button>
        )}
        {assetIds.map((assetId, index) => (
          <a
            key={assetId}
            href={`/api/assets/${assetId}`}
            download={`image-${index + 1}.png`}
            className={buttonVariants({ variant: 'outline' })}
          >
            <ImageDown className="size-4" aria-hidden="true" />
            {assetIds.length > 1 ? `Download image ${index + 1}` : 'Download image'}
          </a>
        ))}
      </div>
      <p role="status" aria-live="polite" className="text-sm text-muted empty:hidden">
        {copied === true && 'Copied to the clipboard.'}
        {copied === false && 'Could not copy. Select the text and copy it by hand.'}
      </p>
      {canExport && <ExportButton brandId={brandId} itemIds={exportable ? [itemId] : []} label="Export ZIP" />}
    </section>
  );
}
