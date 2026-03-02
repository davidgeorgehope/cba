import { EmbeddingError } from '../utils/errors.js';
import type { CBAConfig } from '../config/schema.js';
import type { CodeChunk } from './chunker.js';

export interface EmbeddingResult {
  chunkId: string;
  embedding: number[];
}

export interface EmbedderOptions {
  batchSize?: number;
}

// Lazy-loaded pipeline singleton
let pipelineInstance: Promise<unknown> | null = null;

async function createPipeline(model: string): Promise<unknown> {
  try {
    const { pipeline, env } = await import('@huggingface/transformers');
    // Disable local model check warning
    env.allowLocalModels = false;
    return await pipeline('feature-extraction', model);
  } catch (err) {
    throw new EmbeddingError(
      `Failed to load embedding model "${model}". First run downloads the model and caches it.`,
      err
    );
  }
}

export class Embedder {
  private model: string;

  constructor(config: CBAConfig) {
    this.model = config.embedding.model;
  }

  private async getPipeline(): Promise<unknown> {
    if (!pipelineInstance) {
      pipelineInstance = createPipeline(this.model);
    }
    return pipelineInstance;
  }

  async embedChunks(
    chunks: CodeChunk[],
    options?: EmbedderOptions
  ): Promise<EmbeddingResult[]> {
    const batchSize = options?.batchSize ?? 32;
    const results: EmbeddingResult[] = [];
    const extractor = await this.getPipeline();

    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);
      const texts = batch.map(c => formatChunkForEmbedding(c));

      const embeddings = await this.embedTexts(extractor, texts);

      for (let j = 0; j < batch.length; j++) {
        results.push({
          chunkId: batch[j]!.id,
          embedding: embeddings[j]!,
        });
      }
    }

    return results;
  }

  async embedQuery(query: string): Promise<number[]> {
    const extractor = await this.getPipeline();
    const embeddings = await this.embedTexts(extractor, [query]);
    return embeddings[0]!;
  }

  private async embedTexts(
    extractor: unknown,
    texts: string[]
  ): Promise<number[][]> {
    try {
      const fn = extractor as (text: string, options: Record<string, unknown>) => Promise<{ tolist(): number[][] }>;
      const results: number[][] = [];
      for (const text of texts) {
        const output = await fn(text, { pooling: 'mean', normalize: true });
        const nested = output.tolist();
        results.push(nested[0]!);
      }
      return results;
    } catch (err) {
      throw new EmbeddingError('Embedding failed', err);
    }
  }
}

function formatChunkForEmbedding(chunk: CodeChunk): string {
  const header = `// File: ${chunk.filePath} | ${chunk.chunkType}: ${chunk.symbolName}`;
  return `${header}\n${chunk.content}`;
}
