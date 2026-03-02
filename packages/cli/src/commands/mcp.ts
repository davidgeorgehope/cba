import { Command } from 'commander';

export function registerMcpCommand(program: Command): void {
  program
    .command('mcp')
    .description('Start MCP server (for AI agent integration)')
    .option('--project <path>', 'Default project path')
    .action(async (opts: Record<string, unknown>) => {
      const projectPath = (opts['project'] as string) ?? (program.opts() as { project: string }).project;

      // Dynamic import to avoid loading MCP deps when not needed
      const { startStdio } = await import('@cba/mcp');
      await startStdio(projectPath);
    });
}
