import { z } from 'zod';

const toneScale = z.number().min(0).max(10);

export const brandDnaSchema = z.object({
  identity: z.object({
    name: z.string(),
    tagline: z.string(),
    offering: z.string(),
    products: z.array(z.string()),
  }),
  audience: z.object({
    segments: z.array(z.string()),
    painPoints: z.array(z.string()),
    buyingTriggers: z.array(z.string()),
    objections: z.array(z.string()),
  }),
  voice: z.object({
    tone: z.object({
      formalToCasual: toneScale,
      seriousToPlayful: toneScale,
      reservedToBold: toneScale,
    }),
    dos: z.array(z.string()),
    donts: z.array(z.string()),
    samplePhrases: z.array(z.string()),
  }),
  visuals: z.object({
    palette: z.array(z.string()),
    typography: z.string(),
    imageStyle: z.string(),
    logoAssetId: z.uuid().optional(),
  }),
  competitors: z.array(z.string()),
  languages: z.array(z.string()),
});

export type BrandDna = z.infer<typeof brandDnaSchema>;

export function createPartialBrandDna(parts: {
  name: string;
  palette: string[];
  logoAssetId?: string;
}): BrandDna {
  return {
    identity: { name: parts.name, tagline: '', offering: '', products: [] },
    audience: { segments: [], painPoints: [], buyingTriggers: [], objections: [] },
    voice: {
      tone: { formalToCasual: 5, seriousToPlayful: 5, reservedToBold: 5 },
      dos: [],
      donts: [],
      samplePhrases: [],
    },
    visuals: {
      palette: parts.palette,
      typography: '',
      imageStyle: '',
      ...(parts.logoAssetId ? { logoAssetId: parts.logoAssetId } : {}),
    },
    competitors: [],
    languages: [],
  };
}
