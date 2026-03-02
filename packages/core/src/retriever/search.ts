import { Embedder } from '../indexer/embedder.js';
import { VectorStore, type VectorSearchResult, type SearchFilter } from '../indexer/store.js';
import type { CBAConfig } from '../config/schema.js';

export interface SearchOptions {
  limit?: number;
  minScore?: number;
  filter?: SearchFilter;
  pathGlob?: string;
  languages?: string[];
  chunkTypes?: string[];
}

export interface SearchResult {
  id: string;
  filePath: string;
  startLine: number;
  endLine: number;
  content: string;
  chunkType: string;
  symbolName: string;
  parentSymbol?: string;
  language: string;
  score: number;
  rank: number;
}

export async function searchCodebase(
  query: string,
  embedder: Embedder,
  store: VectorStore,
  config: CBAConfig,
  options?: SearchOptions
): Promise<SearchResult[]> {
  const limit = options?.limit ?? config.search.defaultLimit;
  const minScore = options?.minScore ?? config.search.minScore;

  // Embed the query
  const queryVector = await embedder.embedQuery(query);

  // Build filter
  const filter: SearchFilter = { ...options?.filter };
  if (options?.languages?.length === 1) {
    filter.language = options.languages[0];
  }
  if (options?.chunkTypes?.length === 1) {
    filter.chunkType = options.chunkTypes[0];
  }

  // Search
  const rawResults = await store.search(queryVector, limit * 2, filter);

  if (rawResults.length === 0) return [];

  // Normalize scores to 0-1 range, then filter
  const maxScore = Math.max(...rawResults.map(r => r.score));
  const minRaw = Math.min(...rawResults.map(r => r.score));
  const range = maxScore - minRaw || 1;

  const results: SearchResult[] = rawResults
    .map((r, i) => ({
      id: r.chunk.id,
      filePath: r.chunk.filePath,
      startLine: r.chunk.startLine,
      endLine: r.chunk.endLine,
      content: r.chunk.content,
      chunkType: r.chunk.chunkType,
      symbolName: r.chunk.symbolName,
      parentSymbol: r.chunk.parentSymbol || undefined,
      language: r.chunk.language,
      score: rawResults.length === 1 ? 1 : (r.score - minRaw) / range,
      rank: i + 1,
    }))
    .filter(r => r.score >= minScore)
    .slice(0, limit)
    .map((r, i) => ({ ...r, rank: i + 1 }));

  // Filter by path glob if specified
  if (options?.pathGlob) {
    const glob = options.pathGlob;
    return results.filter(r => matchGlob(r.filePath, glob));
  }

  // Filter by languages if multiple
  if (options?.languages && options.languages.length > 1) {
    const langSet = new Set(options.languages);
    return results.filter(r => langSet.has(r.language));
  }

  return results;
}

function matchGlob(filePath: string, glob: string): boolean {
  // Simple glob matching: * matches anything except /, ** matches anything
  const pattern = glob
    .replace(/\*\*/g, '{{DOUBLE_STAR}}')
    .replace(/\*/g, '[^/]*')
    .replace(/\{\{DOUBLE_STAR\}\}/g, '.*')
    .replace(/\?/g, '[^/]');
  return new RegExp(`^${pattern}$`).test(filePath);
}
