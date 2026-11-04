'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { ApiKeyForm } from './api-key-form';
import { ModelPicker } from './model-picker';

export function SettingsPanel({
  isAdmin,
  keyHint,
  brain,
  image,
}: {
  isAdmin: boolean;
  keyHint: string | null;
  brain: string | null;
  image: string | null;
}) {
  const router = useRouter();
  const [keyVersion, setKeyVersion] = useState(0);
  const refresh = () => router.refresh();
  const keyReplaced = () => {
    setKeyVersion((version) => version + 1);
    refresh();
  };

  return (
    <div className="flex max-w-xl flex-col gap-6">
      <Card>
        <h2 className="text-lg font-semibold">OpenRouter API key</h2>
        <p className="mt-2 text-sm text-muted">
          Stored key: <span className="font-mono text-foreground">{keyHint ?? 'none'}</span>
        </p>
        {isAdmin && (
          <div className="mt-4">
            <ApiKeyForm submitLabel="Replace key" onSaved={keyReplaced} />
          </div>
        )}
      </Card>
      <Card>
        <h2 className="text-lg font-semibold">Brain model</h2>
        {isAdmin ? (
          <div className="mt-4">
            <ModelPicker capability="brain" currentModel={brain} reloadKey={keyVersion} onSaved={refresh} />
          </div>
        ) : (
          <p className="mt-2 text-sm text-muted">{brain ?? 'Not set'}</p>
        )}
      </Card>
      <Card>
        <h2 className="text-lg font-semibold">Image model</h2>
        {isAdmin ? (
          <div className="mt-4">
            <ModelPicker capability="image" currentModel={image} reloadKey={keyVersion} onSaved={refresh} />
          </div>
        ) : (
          <p className="mt-2 text-sm text-muted">{image ?? 'Not set'}</p>
        )}
      </Card>
      {!isAdmin && <p className="text-sm text-muted">Only an admin can change these settings.</p>}
    </div>
  );
}
