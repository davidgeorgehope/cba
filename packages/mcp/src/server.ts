import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CBA } from '@cba/core';
import { registerCodebaseSearchTool } from './tools/codebase-search.js';
import { registerCodebaseExplainTool } from './tools/codebase-explain.js';
import { registerCodebaseAskTool } from './tools/codebase-ask.js';
import { registerIndexProjectTool } from './tools/index-project.js';
import { registerMemoryTools } from './tools/memory.js';
import { registerProjectsResource, registerStatusResource } from './resources/projects.js';
import { registerPromptTemplates } from './prompts/templates.js';

const cbaInstances = new Map<string, CBA>();

export function getCBA(projectPath: string): CBA {
  let cba = cbaInstances.get(projectPath);
  if (!cba) {
    cba = new CBA({ projectPath });
    cbaInstances.set(projectPath, cba);
  }
  return cba;
}

export function createMcpServer(defaultProjectPath?: string): McpServer {
  const server = new McpServer({
    name: 'codebase-agent',
    version: '0.1.0',
  });

  const getProject = (path?: string) => getCBA(path ?? defaultProjectPath ?? process.cwd());

  // Register tools
  registerCodebaseSearchTool(server, getProject);
  registerCodebaseExplainTool(server, getProject);
  registerCodebaseAskTool(server, getProject);
  registerIndexProjectTool(server, getProject);
  registerMemoryTools(server, getProject);

  // Register resources
  registerProjectsResource(server);
  registerStatusResource(server, getProject);

  // Register prompts
  registerPromptTemplates(server);

  return server;
}

export async function startStdio(defaultProjectPath?: string): Promise<void> {
  const server = createMcpServer(defaultProjectPath);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
