import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';
import { CATEGORIES } from './data/site';
import { parseContentDate } from './lib/content-date';
import { dateAwareGlob } from './lib/content-loader';

const contentDate = z.unknown().transform((value, context) => {
  try {
    return parseContentDate(value);
  } catch {
    context.addIssue({
      code: 'custom',
      message: '日期年份必须在 1900–9999，且值必须是有效的 YYYY-MM-DD 或带时区的 ISO datetime',
    });
    return z.NEVER;
  }
});

const posts = defineCollection({
  loader: dateAwareGlob({ pattern: '**/*.{md,mdx}', base: './src/content/posts' }),
  schema: ({ image }) => z.object({
    title: z.string().min(1),
    description: z.string().min(20).max(180),
    publishedAt: contentDate,
    updatedAt: contentDate.optional(),
    category: z.enum(CATEGORIES),
    tags: z.array(z.string().min(1)).default([]),
    draft: z.boolean().default(true),
    cover: image().optional(),
    coverAlt: z.string().min(1).optional(),
  }).superRefine((data, ctx) => {
    if (data.cover && !data.coverAlt) {
      ctx.addIssue({ code: 'custom', path: ['coverAlt'], message: '封面存在时必须填写 coverAlt' });
    }
  }),
});

export const collections = { posts };
