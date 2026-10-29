import { z } from 'zod';

export const CBAConfigSchema = z.object({
  xaiApiKey: z.string().optional(),
  dataDir: z.string().optional(),

  indexing: z.object({
    maxFileSize: z.number().default(1_000_000),
    maxChunkTokens: z.number().default(512),
    batchSize: z.number().default(32),
    concurrency: z.number().default(4),
    excludePatterns: z.array(z.string()).default([]),
    includeExtensions: z.array(z.string()).default([]),
  }).default({}),

  search: z.object({
    defaultLimit: z.number().default(10),
    minScore: z.number().default(0.1),
  }).default({}),

  llm: z.object({
    explainModel: z.string().default('grok-4.7'),
    chatModel: z.string().default('grok-4.7'),
    complexModel: z.string().default('grok-4.7'),
    maxTokens: z.number().default(4096),
  }).default({}),

  embedding: z.object({
    model: z.string().default('Xenova/all-MiniLM-L6-v2'),
    dimensions: z.number().default(384),
  }).default({}),
});

export type CBAConfig = z.infer<typeof CBAConfigSchema>;
