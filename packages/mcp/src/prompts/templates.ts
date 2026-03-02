import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

export function registerPromptTemplates(server: McpServer): void {
  server.prompt(
    'explain-codebase',
    'Generate a comprehensive explanation of a codebase or specific area',
    { area: z.string().optional().describe('Specific area to explain (e.g., "authentication", "database layer")') },
    async (params) => {
      const area = params.area ?? 'the overall architecture';
      return {
        messages: [{
          role: 'user' as const,
          content: {
            type: 'text' as const,
            text: `Use the codebase_search and codebase_explain tools to thoroughly explain ${area} in this codebase.

Steps:
1. Search for relevant code related to "${area}"
2. Explain the key components, patterns, and how they connect
3. Highlight any notable design decisions or potential issues

Provide a structured, comprehensive explanation with code references.`,
          },
        }],
      };
    }
  );

  server.prompt(
    'review-code',
    'Review code in a specific area for issues, patterns, and improvements',
    { area: z.string().describe('Area or file pattern to review') },
    async (params) => {
      return {
        messages: [{
          role: 'user' as const,
          content: {
            type: 'text' as const,
            text: `Use the codebase_search tool to find code related to "${params.area}" and review it for:

1. **Bugs or Issues**: Logic errors, edge cases, potential crashes
2. **Security**: Input validation, injection risks, auth issues
3. **Performance**: N+1 queries, unnecessary allocations, blocking calls
4. **Patterns**: Consistency with codebase conventions, anti-patterns
5. **Improvements**: Suggested refactors or simplifications

Search broadly, then provide a detailed review with specific file and line references.`,
          },
        }],
      };
    }
  );
}
