import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CBA } from '@cba/core';

export function registerCodebaseExplainTool(
  server: McpServer,
  getProject: (path?: string) => CBA
): void {
  server.tool(
    'codebase_explain',
    'Explain a concept, pattern, or piece of code in the codebase. Retrieves relevant code and provides a detailed explanation.',
    {
      query: z.string().describe('What to explain (e.g., "authentication flow", "error handling pattern")'),
      project_path: z.string().optional().describe('Project path (uses default if omitted)'),
      model: z.string().optional().describe('LLM model to use'),
    },
    async (params) => {
      const cba = getProject(params.project_path);

      try {
        const result = await cba.explain(params.query, undefined, {
          model: params.model,
        });

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              explanation: result.explanation,
              sources: result.sources.map(s => ({
                filePath: s.filePath,
                startLine: s.startLine + 1,
                endLine: s.endLine + 1,
                symbolName: s.symbolName,
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
