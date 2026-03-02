import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { CBA } from '@cba/core';

export function registerProjectsResource(server: McpServer): void {
  server.resource(
    'projects',
    'cba://projects',
    { description: 'List all indexed projects', mimeType: 'application/json' },
    async () => {
      const projects = await CBA.listProjects();
      return {
        contents: [{
          uri: 'cba://projects',
          mimeType: 'application/json',
          text: JSON.stringify(projects, null, 2),
        }],
      };
    }
  );
}

export function registerStatusResource(
  server: McpServer,
  getProject: (path?: string) => CBA
): void {
  server.resource(
    'status',
    'cba://status/{path}',
    { description: 'Get indexing status for a project', mimeType: 'application/json' },
    async (uri) => {
      const path = decodeURIComponent(uri.pathname.slice(1)); // Remove leading /
      const cba = getProject(path || undefined);
      const status = await cba.getStatus();
      return {
        contents: [{
          uri: uri.href,
          mimeType: 'application/json',
          text: JSON.stringify(status, null, 2),
        }],
      };
    }
  );
}
