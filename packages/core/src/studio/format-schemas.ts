import { z } from 'zod';
import type { ItemFormat } from '../planner/channel-formats';

export const MAX_HEADLINE_LENGTH = 120;

const imageBriefSchema = z.object({
  prompt: z.string().min(1),
  headlineOverlay: z.string().max(MAX_HEADLINE_LENGTH).optional(),
});

const socialPostCopySchema = z.object({
  caption: z.string().min(1),
  hashtags: z.array(z.string()).max(5),
  imageBrief: imageBriefSchema,
});

const carouselCopySchema = z.object({
  slides: z
    .array(z.object({ title: z.string().min(1), text: z.string().min(1), imageBrief: imageBriefSchema }))
    .min(3)
    .max(8),
  caption: z.string().min(1),
});

const staticAdCopySchema = z.object({
  headline: z.string().min(1),
  primaryText: z.string().min(1),
  callToAction: z.string().min(1),
  imageBrief: imageBriefSchema,
});

const emailCopySchema = z.object({
  subject: z.string().min(1),
  preheader: z.string(),
  body: z.string().min(1),
});

const blogPostCopySchema = z.object({
  seoTitle: z.string().min(1),
  metaDescription: z.string().min(1),
  outline: z.array(z.string()).min(1),
  article: z.string().min(1),
  faq: z.array(z.object({ question: z.string().min(1), answer: z.string().min(1) })),
});

export type SocialPostCopy = z.infer<typeof socialPostCopySchema>;
export type CarouselCopy = z.infer<typeof carouselCopySchema>;
export type StaticAdCopy = z.infer<typeof staticAdCopySchema>;
export type EmailCopy = z.infer<typeof emailCopySchema>;
export type BlogPostCopy = z.infer<typeof blogPostCopySchema>;
export type FormatCopy = SocialPostCopy | CarouselCopy | StaticAdCopy | EmailCopy | BlogPostCopy;

export const formatCopySchemas: Record<ItemFormat, z.ZodType<FormatCopy>> = {
  social_post: socialPostCopySchema,
  carousel: carouselCopySchema,
  static_ad: staticAdCopySchema,
  email: emailCopySchema,
  blog_post: blogPostCopySchema,
};
