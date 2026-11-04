'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { EmptyState } from '@/components/empty-state';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ApiKeyForm } from './api-key-form';
import { ModelPicker } from './model-picker';

type Step = 'welcome' | 'key' | 'brain' | 'image';

const stepTitles: Record<Exclude<Step, 'welcome'>, string> = {
  key: 'Step 1 of 3: Connect OpenRouter',
  brain: 'Step 2 of 3: Choose the brain model',
  image: 'Step 3 of 3: Choose the image model',
};

export function SetupWizard({
  initialStep,
  brain,
  image,
}: {
  initialStep: Step;
  brain: string | null;
  image: string | null;
}) {
  const router = useRouter();
  const [step, setStep] = useState<Step>(initialStep);

  if (step === 'welcome') {
    return (
      <EmptyState
        spot="setup-welcome"
        title="Welcome to OpenLumo"
        description="Connect your OpenRouter key and pick two models. It takes a minute."
        action={<Button onClick={() => setStep('key')}>Get started</Button>}
      />
    );
  }

  return (
    <Card className="mx-auto w-full max-w-lg">
      <h1 className="text-xl font-bold tracking-tight">{stepTitles[step]}</h1>
      <div className="mt-6">
        {step === 'key' && <ApiKeyForm submitLabel="Verify and continue" onSaved={() => setStep('brain')} />}
        {step === 'brain' && (
          <ModelPicker capability="brain" currentModel={brain} submitLabel="Continue" onSaved={() => setStep('image')} />
        )}
        {step === 'image' && (
          <ModelPicker
            capability="image"
            currentModel={image}
            submitLabel="Finish setup"
            onSaved={() => {
              router.push('/');
              router.refresh();
            }}
          />
        )}
      </div>
    </Card>
  );
}
