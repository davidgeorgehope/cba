import { Command } from 'commander';
import chalk from 'chalk';
import { CBA } from '@cba/core';
import { createSpinner } from '../formatters/progress.js';
import { formatSearchResults, formatSearchResultsJson } from '../formatters/search-results.js';

export function registerSearchCommand(program: Command): void {
  program
    .command('search <query>')
    .description('Semantic search with AI explanations')
    .option('-n, --limit <number>', 'Maximum results', '10')
    .option('--min-score <score>', 'Minimum similarity score (0-1)', '0.3')
    .option('--path <glob>', 'Filter by file path glob')
    .option('--lang <languages...>', 'Filter by language')
    .option('--type <types...>', 'Filter by chunk type')
    .option('--no-explain', 'Skip LLM explanations (faster)')
    .action(async (query: string, opts: Record<string, unknown>) => {
      const projectPath = (program.opts() as { project: string }).project;
      const jsonOutput = (program.opts() as { json?: boolean }).json;
      const noExplain = opts['explain'] === false;

      const cba = new CBA({ projectPath });
      const spinner = createSpinner(`Searching for "${query}"...`);

      if (!jsonOutput) spinner.start();

      try {
        if (noExplain) {
          const results = await cba.search(query, {
            limit: Number(opts['limit']),
            minScore: Number(opts['minScore']),
            pathGlob: opts['path'] as string | undefined,
            languages: opts['lang'] as string[] | undefined,
            chunkTypes: opts['type'] as string[] | undefined,
          });

          if (!jsonOutput) {
            spinner.stop();
            console.log(formatSearchResults(results, query));
          } else {
            console.log(formatSearchResultsJson(results));
          }
        } else {
          if (!jsonOutput) spinner.text = `Searching and explaining "${query}"...`;

          const results = await cba.searchAndExplain(query, {
            limit: Number(opts['limit']),
            minScore: Number(opts['minScore']),
            pathGlob: opts['path'] as string | undefined,
            languages: opts['lang'] as string[] | undefined,
            chunkTypes: opts['type'] as string[] | undefined,
          });

          if (!jsonOutput) {
            spinner.stop();
            console.log(formatSearchResults(results, query));
          } else {
            console.log(formatSearchResultsJson(results));
          }
        }
      } catch (err) {
        if (!jsonOutput) {
          spinner.fail(chalk.red((err as Error).message));
        } else {
          console.error(JSON.stringify({ error: (err as Error).message }));
        }
        process.exitCode = 1;
      } finally {
        await cba.close();
      }
    });
}
