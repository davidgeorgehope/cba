import { Command } from 'commander';
import chalk from 'chalk';
import { CBA } from '@cba/core';
import { createSpinner, attachProgressListeners } from '../formatters/progress.js';
import { formatJson } from '../formatters/json.js';

export function registerIndexCommand(program: Command): void {
  program
    .command('index [path]')
    .description('Index a codebase for semantic search')
    .option('--reindex', 'Force full re-index')
    .option('--exclude <patterns...>', 'Glob patterns to exclude')
    .option('--include-ext <extensions...>', 'File extensions to include')
    .option('--max-file-size <bytes>', 'Maximum file size in bytes', '1000000')
    .action(async (path: string | undefined, opts: Record<string, unknown>) => {
      const projectPath = path ?? (program.opts() as { project: string }).project;
      const jsonOutput = (program.opts() as { json?: boolean }).json;

      const cba = new CBA({ projectPath });
      const spinner = createSpinner('Starting indexing...');

      if (!jsonOutput) {
        attachProgressListeners(cba, spinner);
        spinner.start();
      }

      try {
        const indexFn = opts['reindex'] ? cba.reindex.bind(cba) : cba.index.bind(cba);
        const result = await indexFn({
          excludePatterns: opts['exclude'] as string[] | undefined,
          includeExtensions: opts['includeExt'] as string[] | undefined,
          maxFileSize: Number(opts['maxFileSize']),
        });

        if (jsonOutput) {
          console.log(formatJson(result));
        } else {
          spinner.succeed(chalk.green('Indexing complete!'));
          console.log(chalk.dim(`  Files: ${result.totalFiles} (${result.newFiles} new, ${result.changedFiles} changed, ${result.removedFiles} removed)`));
          console.log(chalk.dim(`  Chunks: ${result.totalChunks}`));
          console.log(chalk.dim(`  Duration: ${(result.durationMs / 1000).toFixed(1)}s`));
        }
      } catch (err) {
        if (!jsonOutput) {
          spinner.fail(chalk.red(`Indexing failed: ${(err as Error).message}`));
        } else {
          console.error(formatJson({ error: (err as Error).message }));
        }
        process.exitCode = 1;
      } finally {
        await cba.close();
      }
    });
}
