import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CBA } from '@cba/core';

export function registerCodebaseAskTool(
  server: McpServer,
  getProject: (path?: string) => CBA
): void {
  server.tool(
    'codebase_ask',
    'Answer a factual question about the codebase, grounded in the actual code. Returns an answer with source references.',
    {
      question: z.string().describe('Question about the codebase'),
      project_path: z.string().optional().describe('Project path (uses default if omitted)'),
      context_chunks: z.number().optional().default(10).describe('Number of code chunks for context'),
      model: z.string().optional().describe('LLM model to use'),
    },
    async (params) => {
      const cba = getProject(params.project_path);

      try {
        const result = await cba.ask(params.question, {
          contextChunks: params.context_chunks,
          model: params.model,
        });

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              answer: result.answer,
              sources: result.sources.map(s => ({
                filePath: s.filePath,
                startLine: s.startLine + 1,
                endLine: s.endLine + 1,
                symbolName: s.symbolName,
                score: s.score,
              })),
              usage: {
                inputTokens: result.inputTokens,
                outputTokens: result.outputTokens,
              },
            }, null, 2),
          }],
        };
      } catch (err) {
        return {
          content: [{
            type: 'text' as const,
            text: `Error: ${(err as Error).message}`,
          }],
          isError: true,
        };
      }
    }
  );
}
