import type { SearchResult } from './search.js';

export interface ContextBlock {
  filePath: string;
  startLine: number;
  endLine: number;
  content: string;
  chunkType: string;
  symbolName: string;
  score: number;
}

export function buildPromptContext(
  results: SearchResult[],
  maxTokens: number = 8000
): { context: string; blocks: ContextBlock[] } {
  // Deduplicate overlapping chunks from the same file
  const deduped = deduplicateResults(results);

  // Build context string within token budget
  const blocks: ContextBlock[] = [];
  let totalTokens = 0;

  for (const result of deduped) {
    const block: ContextBlock = {
      filePath: result.filePath,
      startLine: result.startLine,
      endLine: result.endLine,
      content: result.content,
      chunkType: result.chunkType,
      symbolName: result.symbolName,
      score: result.score,
    };

    const blockTokens = estimateTokens(formatBlock(block));
    if (totalTokens + blockTokens > maxTokens) break;

    blocks.push(block);
    totalTokens += blockTokens;
  }

  const context = blocks.map(formatBlock).join('\n\n');
  return { context, blocks };
}

function formatBlock(block: ContextBlock): string {
  const header = `--- ${block.filePath}:${block.startLine + 1}-${block.endLine + 1} (${block.chunkType}: ${block.symbolName}) ---`;
  return `${header}\n${block.content}`;
}

function deduplicateResults(results: SearchResult[]): SearchResult[] {
  const seen = new Map<string, SearchResult>();

  for (const result of results) {
    const key = `${result.filePath}:${result.startLine}`;
    const existing = seen.get(key);

    if (!existing || result.score > existing.score) {
      // Check for overlaps with existing results
      let isOverlap = false;
      for (const [existingKey, existingResult] of seen) {
        if (
          existingResult.filePath === result.filePath &&
          existingResult.startLine <= result.endLine &&
          existingResult.endLine >= result.startLine
        ) {
          // Overlap: keep the higher-scoring one
          if (result.score > existingResult.score) {
            seen.delete(existingKey);
            seen.set(key, result);
          }
          isOverlap = true;
          break;
        }
      }

      if (!isOverlap) {
        seen.set(key, result);
      }
    }
  }

  return [...seen.values()].sort((a, b) => b.score - a.score);
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
