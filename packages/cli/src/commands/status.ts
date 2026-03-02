import { Command } from 'commander';
import chalk from 'chalk';
import { CBA } from '@cba/core';

export function registerStatusCommand(program: Command): void {
  program
    .command('status [path]')
    .description('Show indexing status')
    .option('--list', 'List all indexed projects')
    .action(async (path: string | undefined, opts: Record<string, unknown>) => {
      const jsonOutput = (program.opts() as { json?: boolean }).json;

      if (opts['list']) {
        const projects = await CBA.listProjects();
        if (jsonOutput) {
          console.log(JSON.stringify(projects, null, 2));
        } else {
          if (projects.length === 0) {
            console.log(chalk.dim('No indexed projects.'));
            return;
          }
          console.log(chalk.bold('Indexed Projects:\n'));
          for (const p of projects) {
            const age = p.lastIndexed
              ? formatAge(Date.now() - p.lastIndexed)
              : 'never';
            console.log(`  ${chalk.bold.white(p.projectName)}`);
            console.log(chalk.dim(`    Path: ${p.projectPath}`));
            console.log(chalk.dim(`    Last indexed: ${age}`));
            console.log('');
          }
        }
        return;
      }

      const projectPath = path ?? (program.opts() as { project: string }).project;
      const cba = new CBA({ projectPath });

      try {
        const status = await cba.getStatus();

        if (jsonOutput) {
          console.log(JSON.stringify(status, null, 2));
        } else {
          console.log(chalk.bold(`Project: ${status.projectName}\n`));
          console.log(`  ${chalk.dim('Path:')}     ${status.projectPath}`);
          console.log(`  ${chalk.dim('Indexed:')}  ${status.indexed ? chalk.green('Yes') : chalk.red('No')}`);
          console.log(`  ${chalk.dim('Files:')}    ${status.totalFiles}`);
          console.log(`  ${chalk.dim('Chunks:')}   ${status.totalChunks}`);
          if (status.lastIndexed) {
            console.log(`  ${chalk.dim('Updated:')}  ${formatAge(Date.now() - status.lastIndexed)}`);
          }
          console.log(`  ${chalk.dim('Data:')}     ${status.dataDir}`);
        }
      } catch (err) {
        console.error(chalk.red((err as Error).message));
        process.exitCode = 1;
      } finally {
        await cba.close();
      }
    });
}

function formatAge(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
