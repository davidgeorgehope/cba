import { LLMClient } from './client.js';
import { SYSTEM_EXPLAIN, buildExplainPrompt } from './prompts.js';
import type { SearchResult } from '../retriever/search.js';
import { LLMError } from '../utils/errors.js';

export interface ExplainedSearchResult extends SearchResult {
  explanation: string;
}

export async function explainResults(
  query: string,
  results: SearchResult[],
  llmClient: LLMClient,
  model?: string
): Promise<ExplainedSearchResult[]> {
  if (results.length === 0) return [];

  const chunks = results.map(r => ({
    id: r.id,
    content: r.content,
    filePath: r.filePath,
    symbolName: r.symbolName,
  }));

  const prompt = buildExplainPrompt(query, chunks);

  try {
    const response = await llmClient.complete(
      [{ role: 'user', content: prompt }],
      { system: SYSTEM_EXPLAIN, model, temperature: 0.2 }
    );

    const explanations = parseExplanations(response.content);
    const explanationMap = new Map(explanations.map(e => [e.id, e.explanation]));

    return results.map(r => ({
      ...r,
      explanation: explanationMap.get(r.id) ?? 'No explanation generated.',
    }));
  } catch (err) {
    if (err instanceof LLMError) throw err;
    // Fallback: return results without explanations
    return results.map(r => ({
      ...r,
      explanation: 'Explanation unavailable.',
    }));
  }
}

function parseExplanations(content: string): Array<{ id: string; explanation: string }> {
  try {
    // Extract JSON from response (might have markdown code fences)
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];

    const parsed = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((item: unknown): item is { id: string; explanation: string } =>
        typeof item === 'object' && item !== null &&
        'id' in item && 'explanation' in item &&
        typeof (item as Record<string, unknown>).id === 'string' &&
        typeof (item as Record<string, unknown>).explanation === 'string'
      );
  } catch {
    return [];
  }
}
