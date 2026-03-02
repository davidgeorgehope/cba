import { Command } from 'commander';
import chalk from 'chalk';
import { CBA } from '@cba/core';
import { createSpinner } from '../formatters/progress.js';
import { renderMarkdown } from '../formatters/markdown.js';

export function registerAskCommand(program: Command): void {
  program
    .command('ask <question>')
    .description('One-shot question about the codebase')
    .option('--context <n>', 'Number of context chunks', '10')
    .option('--model <model>', 'Model to use')
    .option('--show-sources', 'Show source code references')
    .action(async (question: string, opts: Record<string, unknown>) => {
      const projectPath = (program.opts() as { project: string }).project;
      const jsonOutput = (program.opts() as { json?: boolean }).json;

      const cba = new CBA({ projectPath });
      const spinner = createSpinner(`Thinking about "${question}"...`);

      if (!jsonOutput) spinner.start();

      try {
        const result = await cba.ask(question, {
          contextChunks: Number(opts['context']),
          model: opts['model'] as string | undefined,
          showSources: opts['showSources'] as boolean | undefined,
        });

        if (jsonOutput) {
          console.log(JSON.stringify({
            answer: result.answer,
            sources: result.sources.map(s => ({
              filePath: s.filePath,
              startLine: s.startLine + 1,
              endLine: s.endLine + 1,
              symbolName: s.symbolName,
              score: s.score,
            })),
            usage: {
              inputTokens: result.inputTokens,
              outputTokens: result.outputTokens,
            },
          }, null, 2));
        } else {
          spinner.stop();
          console.log(renderMarkdown(result.answer));

          if (opts['showSources']) {
            console.log(chalk.dim('\nSources:'));
            for (const source of result.sources.slice(0, 5)) {
              console.log(chalk.dim(`  ${source.filePath}:${source.startLine + 1} (${source.symbolName})`));
            }
          }

          console.log(chalk.dim(`\nTokens: ${result.inputTokens} in / ${result.outputTokens} out`));
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
