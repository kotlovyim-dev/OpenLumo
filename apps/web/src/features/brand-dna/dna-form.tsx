'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent, type ReactNode } from 'react';
import type { BrandDna } from '@openlumo/core';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { updateBrandDna } from './actions';
import { ChipsField, PaletteField, TextField, ToneField } from './dna-fields';

const tones = [
  { key: 'formalToCasual', label: 'Formality', low: 'Formal', high: 'Casual' },
  { key: 'seriousToPlayful', label: 'Mood', low: 'Serious', high: 'Playful' },
  { key: 'reservedToBold', label: 'Attitude', low: 'Reserved', high: 'Bold' },
] as const;

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      {children}
    </Card>
  );
}

export function DnaForm({ brandId, initial, canEdit }: { brandId: string; initial: BrandDna; canEdit: boolean }) {
  const router = useRouter();
  const [dna, setDna] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const readOnly = !canEdit;

  function paletteErrors() {
    const found: Record<number, string> = {};
    for (const [key, text] of Object.entries(errors)) {
      const match = /^visuals\.palette\.(\d+)$/.exec(key);
      if (match) found[Number(match[1])] = text;
    }
    return found;
  }

  function errorFor(id: string) {
    return errors[id] ?? Object.entries(errors).find(([key]) => key.startsWith(`${id}.`))?.[1];
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setMessage(null);
    try {
      const result = await updateBrandDna(brandId, dna);
      if (result.ok) {
        setErrors({});
        setMessage('Saved.');
        router.refresh();
      } else {
        setErrors(result.fieldErrors ?? {});
        setMessage('Some fields need attention.');
      }
    } catch {
      setMessage('Something went wrong. Try again.');
    } finally {
      setPending(false);
    }
  }

  const { identity, audience, voice, visuals } = dna;
  const text = (id: string, label: string, value: string, onChange: (value: string) => void, multiline?: boolean) => (
    <TextField id={id} label={label} value={value} onChange={onChange} error={errorFor(id)} readOnly={readOnly} multiline={multiline} />
  );
  const chips = (id: string, label: string, values: string[], onChange: (values: string[]) => void) => (
    <ChipsField id={id} label={label} values={values} onChange={onChange} error={errorFor(id)} readOnly={readOnly} />
  );

  return (
    <form onSubmit={submit} className="flex flex-col gap-6">
      <Section title="Identity">
        {text('identity.name', 'Brand name', identity.name, (name) => setDna({ ...dna, identity: { ...identity, name } }))}
        {text('identity.tagline', 'Tagline', identity.tagline, (tagline) => setDna({ ...dna, identity: { ...identity, tagline } }))}
        {text('identity.offering', 'What you offer', identity.offering, (offering) => setDna({ ...dna, identity: { ...identity, offering } }), true)}
        {chips('identity.products', 'Products', identity.products, (products) => setDna({ ...dna, identity: { ...identity, products } }))}
      </Section>
      <Section title="Audience">
        {chips('audience.segments', 'Segments', audience.segments, (segments) => setDna({ ...dna, audience: { ...audience, segments } }))}
        {chips('audience.painPoints', 'Pain points', audience.painPoints, (painPoints) => setDna({ ...dna, audience: { ...audience, painPoints } }))}
        {chips('audience.buyingTriggers', 'Buying triggers', audience.buyingTriggers, (buyingTriggers) => setDna({ ...dna, audience: { ...audience, buyingTriggers } }))}
        {chips('audience.objections', 'Objections', audience.objections, (objections) => setDna({ ...dna, audience: { ...audience, objections } }))}
      </Section>
      <Section title="Voice">
        {tones.map(({ key, label, low, high }) => (
          <ToneField
            key={key}
            id={`voice.tone.${key}`}
            label={label}
            low={low}
            high={high}
            value={voice.tone[key]}
            onChange={(value) => setDna({ ...dna, voice: { ...voice, tone: { ...voice.tone, [key]: value } } })}
            error={errors[`voice.tone.${key}`]}
            readOnly={readOnly}
          />
        ))}
        {chips('voice.dos', 'Do', voice.dos, (dos) => setDna({ ...dna, voice: { ...voice, dos } }))}
        {chips('voice.donts', 'Do not', voice.donts, (donts) => setDna({ ...dna, voice: { ...voice, donts } }))}
        {chips('voice.samplePhrases', 'Sample phrases', voice.samplePhrases, (samplePhrases) => setDna({ ...dna, voice: { ...voice, samplePhrases } }))}
      </Section>
      <Section title="Visuals">
        {visuals.logoAssetId && (
          <img src={`/api/assets/${visuals.logoAssetId}`} alt={`${identity.name || 'Brand'} logo`} className="h-16 w-auto self-start rounded-control" />
        )}
        <PaletteField
          id="visuals.palette"
          label="Palette"
          values={visuals.palette}
          onChange={(palette) => setDna({ ...dna, visuals: { ...visuals, palette } })}
          errors={paletteErrors()}
          readOnly={readOnly}
        />
        {errors['visuals.palette'] && (
          <p role="alert" className="text-xs text-danger">
            {errors['visuals.palette']}
          </p>
        )}
        {text('visuals.typography', 'Typography', visuals.typography, (typography) => setDna({ ...dna, visuals: { ...visuals, typography } }))}
        {text('visuals.imageStyle', 'Image style', visuals.imageStyle, (imageStyle) => setDna({ ...dna, visuals: { ...visuals, imageStyle } }), true)}
      </Section>
      <Section title="Market">
        {chips('competitors', 'Competitors', dna.competitors.map((competitor) => competitor.name), (names) =>
          setDna({
            ...dna,
            competitors: names.map(
              (name) =>
                dna.competitors.find((competitor) => competitor.name === name) ?? {
                  name,
                  url: '',
                  positioning: '',
                  strengths: [],
                  weaknesses: [],
                  sourceUrls: [],
                },
            ),
          }),
        )}
        {chips('languages', 'Languages', dna.languages, (languages) => setDna({ ...dna, languages }))}
      </Section>
      {canEdit && (
        <div className="flex items-center gap-4">
          <Button type="submit" disabled={pending}>
            {pending ? 'Saving...' : 'Save brand DNA'}
          </Button>
          <p role="status" className="text-sm text-muted">
            {message}
          </p>
        </div>
      )}
    </form>
  );
}
