import { LLMClient } from '../llm/client.js';

const EXTRACT_PROMPT = `Analyze this conversation about a codebase and extract important facts that would be useful to remember for future questions. Focus on:
- Architecture decisions
- Key patterns and conventions
- Important file locations and their purposes
- How components relate to each other
- Technology choices and their rationale

Conversation:
{conversation}

Return a JSON array of objects with "fact" and "category" fields. Categories: "architecture", "pattern", "location", "relationship", "technology", "convention".
Return ONLY the JSON array. If no important facts, return [].`;

export async function extractFacts(
  conversation: string,
  llmClient: LLMClient
): Promise<Array<{ fact: string; category: string }>> {
  try {
    const prompt = EXTRACT_PROMPT.replace('{conversation}', conversation);
    const response = await llmClient.complete(
      [{ role: 'user', content: prompt }],
      { temperature: 0.1, maxTokens: 1024 }
    );

    const jsonMatch = response.content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];

    const parsed = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(parsed)) return [];

    return parsed.filter(
      (item: unknown): item is { fact: string; category: string } =>
        typeof item === 'object' && item !== null &&
        'fact' in item && 'category' in item &&
        typeof (item as Record<string, unknown>).fact === 'string' &&
        typeof (item as Record<string, unknown>).category === 'string'
    );
  } catch {
    return [];
  }
}
