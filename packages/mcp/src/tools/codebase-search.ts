import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CBA } from '@cba/core';

export function registerCodebaseSearchTool(
  server: McpServer,
  getProject: (path?: string) => CBA
): void {
  server.tool(
    'codebase_search',
    'Semantic search across the indexed codebase. Returns ranked code chunks with optional LLM-generated explanations of relevance.',
    {
      query: z.string().describe('Natural language search query'),
      project_path: z.string().optional().describe('Project path (uses default if omitted)'),
      limit: z.number().optional().default(10).describe('Maximum results to return'),
      min_score: z.number().optional().default(0.3).describe('Minimum similarity score (0-1)'),
      explain: z.boolean().optional().default(true).describe('Include LLM explanations'),
      language: z.string().optional().describe('Filter by programming language'),
      path_glob: z.string().optional().describe('Filter by file path glob pattern'),
    },
    async (params) => {
      const cba = getProject(params.project_path);

      try {
        if (params.explain) {
          const results = await cba.searchAndExplain(params.query, {
            limit: params.limit,
            minScore: params.min_score,
            languages: params.language ? [params.language] : undefined,
            pathGlob: params.path_glob,
          });

          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify(results.map(r => ({
                rank: r.rank,
                score: r.score,
                filePath: r.filePath,
                startLine: r.startLine + 1,
                endLine: r.endLine + 1,
                chunkType: r.chunkType,
                symbolName: r.symbolName,
                content: r.content,
                explanation: r.explanation,
              })), null, 2),
            }],
          };
        } else {
          const results = await cba.search(params.query, {
            limit: params.limit,
            minScore: params.min_score,
            languages: params.language ? [params.language] : undefined,
            pathGlob: params.path_glob,
          });

          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify(results.map(r => ({
                rank: r.rank,
                score: r.score,
                filePath: r.filePath,
                startLine: r.startLine + 1,
                endLine: r.endLine + 1,
                chunkType: r.chunkType,
                symbolName: r.symbolName,
                content: r.content,
              })), null, 2),
            }],
          };
        }
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
