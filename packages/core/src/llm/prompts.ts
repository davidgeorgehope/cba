export const SYSTEM_EXPLAIN = `You are a code analysis expert. You explain code search results to developers, focusing on relevance and purpose.

Rules:
- Be concise but specific
- Reference actual function/variable names from the code
- Explain WHY each result is relevant to the query
- If code is not relevant, say so honestly`;

export const SYSTEM_ASK = `You are a codebase expert. Answer questions about the codebase using ONLY the provided code context.

Rules:
- Ground every claim in specific code from the context
- Reference file paths and line numbers
- If the answer isn't in the context, say "I couldn't find this in the indexed code"
- Be precise and technical`;

export const SYSTEM_CHAT = `You are a codebase assistant helping a developer understand and work with their code. You have access to semantic search results from their codebase.

Rules:
- Ground answers in the provided code context
- Reference specific files, functions, and line numbers
- Ask for clarification if the question is ambiguous
- Remember context from earlier in the conversation
- Be concise but thorough`;

export function buildExplainPrompt(query: string, chunks: Array<{ id: string; content: string; filePath: string; symbolName: string }>): string {
  const chunksText = chunks.map((c, i) =>
    `[${i + 1}] ID: ${c.id}\nFile: ${c.filePath} | Symbol: ${c.symbolName}\n\`\`\`\n${c.content}\n\`\`\``
  ).join('\n\n');

  return `Search query: "${query}"

The following code chunks were returned as search results. For each chunk, provide a brief (1-2 sentence) explanation of why it's relevant to the query.

${chunksText}

Respond with a JSON array of objects with "id" and "explanation" fields. Example:
[{"id": "abc123", "explanation": "This function handles user authentication by..."}]

Return ONLY the JSON array, no other text.`;
}

export function buildAskPrompt(question: string, context: string): string {
  return `Code context from the codebase:

${context}

Question: ${question}

Answer the question based on the code context above. Reference specific files and line numbers.`;
}

export function buildChatPrompt(message: string, context: string, memory?: string): string {
  let prompt = '';

  if (memory) {
    prompt += `Relevant memory about this codebase:\n${memory}\n\n`;
  }

  if (context) {
    prompt += `Relevant code context:\n${context}\n\n`;
  }

  prompt += `User message: ${message}`;
  return prompt;
}
