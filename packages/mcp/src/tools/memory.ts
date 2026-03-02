import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CBA } from '@cba/core';

export function registerMemoryTools(
  server: McpServer,
  getProject: (path?: string) => CBA
): void {
  server.tool(
    'memory_search',
    'Search persistent memory for facts about the codebase. Memory stores architecture decisions, patterns, conventions, etc.',
    {
      query: z.string().describe('Search query for memory entries'),
      project_path: z.string().optional().describe('Project path (uses default if omitted)'),
    },
    async (params) => {
      const cba = getProject(params.project_path);

      try {
        const entries = await cba.memory.search(params.query);
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify(entries, null, 2),
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

  server.tool(
    'memory_add',
    'Store a fact about the codebase in persistent memory for future reference.',
    {
      fact: z.string().describe('The fact to remember'),
      category: z.string().optional().default('general').describe('Category: architecture, pattern, location, relationship, technology, convention'),
      project_path: z.string().optional().describe('Project path (uses default if omitted)'),
    },
    async (params) => {
      const cba = getProject(params.project_path);

      try {
        const entry = await cba.memory.add(params.fact, params.category, 'agent');
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({ success: true, id: entry.id }, null, 2),
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
