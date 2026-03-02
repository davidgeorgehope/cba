import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CBA } from '@cba/core';

export function registerIndexProjectTool(
  server: McpServer,
  getProject: (path?: string) => CBA
): void {
  server.tool(
    'index_project',
    'Index or re-index a project for semantic search. Must be done before searching.',
    {
      project_path: z.string().optional().describe('Project path (uses default if omitted)'),
      reindex: z.boolean().optional().default(false).describe('Force full re-index'),
    },
    async (params) => {
      const cba = getProject(params.project_path);

      try {
        const result = params.reindex
          ? await cba.reindex()
          : await cba.index();

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              success: true,
              totalFiles: result.totalFiles,
              totalChunks: result.totalChunks,
              newFiles: result.newFiles,
              changedFiles: result.changedFiles,
              removedFiles: result.removedFiles,
              durationMs: result.durationMs,
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
