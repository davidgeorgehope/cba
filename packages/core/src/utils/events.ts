export interface CBAEvents {
  'index:start': { totalFiles: number };
  'index:file': { filePath: string; current: number; total: number };
  'index:chunk': { filePath: string; chunkCount: number };
  'index:embed': { batch: number; totalBatches: number; chunkCount: number };
  'index:store': { chunkCount: number };
  'index:complete': { totalFiles: number; totalChunks: number; durationMs: number };
  'index:error': { filePath: string; error: Error };

  'search:start': { query: string };
  'search:results': { count: number; durationMs: number };

  'llm:start': { model: string };
  'llm:token': { token: string };
  'llm:complete': { model: string; inputTokens: number; outputTokens: number };

  'memory:extract': { facts: string[] };
  'memory:save': { id: string };
}

export type CBAEventName = keyof CBAEvents;
