import { Command } from 'commander';
import chalk from 'chalk';
import { createInterface } from 'node:readline';
import { CBA } from '@cba/core';
import { renderMarkdown } from '../formatters/markdown.js';

export function registerChatCommand(program: Command): void {
  program
    .command('chat')
    .description('Interactive chat session (REPL)')
    .option('--resume <id>', 'Resume a conversation')
    .option('--no-memory', 'Disable memory')
    .option('--model <model>', 'Model to use')
    .action(async (opts: Record<string, unknown>) => {
      const projectPath = (program.opts() as { project: string }).project;

      const cba = new CBA({ projectPath });
      const conversationId = opts['resume'] as string | undefined;
      const includeMemory = opts['memory'] !== false;

      console.log(chalk.bold.cyan('CBA Chat'));
      console.log(chalk.dim('Type your questions about the codebase. Commands: /exit, /clear, /sources'));
      console.log('');

      const rl = createInterface({
        input: process.stdin,
        output: process.stdout,
        prompt: chalk.green('> '),
      });

      let lastSources: Array<{ filePath: string; startLine: number; symbolName: string }> = [];

      rl.prompt();

      rl.on('line', async (line) => {
        const input = line.trim();
        if (!input) {
          rl.prompt();
          return;
        }

        // Handle commands
        if (input === '/exit' || input === '/quit') {
          console.log(chalk.dim('Goodbye!'));
          rl.close();
          return;
        }

        if (input === '/clear') {
          console.clear();
          console.log(chalk.dim('Conversation cleared.'));
          rl.prompt();
          return;
        }

        if (input === '/sources') {
          if (lastSources.length === 0) {
            console.log(chalk.dim('No sources from last response.'));
          } else {
            console.log(chalk.dim('Sources from last response:'));
            for (const s of lastSources) {
              console.log(chalk.dim(`  ${s.filePath}:${s.startLine + 1} (${s.symbolName})`));
            }
          }
          rl.prompt();
          return;
        }

        if (input === '/memory') {
          const entries = await cba.memory.list();
          if (entries.length === 0) {
            console.log(chalk.dim('No memories stored.'));
          } else {
            for (const e of entries) {
              console.log(chalk.dim(`  [${e.category}] ${e.fact}`));
            }
          }
          rl.prompt();
          return;
        }

        try {
          // Stream response
          process.stdout.write(chalk.cyan('\n'));
          let fullContent = '';

          for await (const event of cba.chatStream(input, conversationId, {
            model: opts['model'] as string | undefined,
            includeMemory,
          })) {
            if (event.type === 'text' && event.text) {
              process.stdout.write(event.text);
              fullContent += event.text;
            } else if (event.type === 'sources' && event.sources) {
              lastSources = event.sources.map(s => ({
                filePath: s.filePath,
                startLine: s.startLine,
                symbolName: s.symbolName,
              }));
            } else if (event.type === 'done') {
              console.log('\n');
              if (event.result) {
                console.log(chalk.dim(`Tokens: ${event.result.inputTokens} in / ${event.result.outputTokens} out`));
              }
            }
          }
        } catch (err) {
          console.log(chalk.red(`\nError: ${(err as Error).message}`));
        }

        rl.prompt();
      });

      rl.on('close', async () => {
        await cba.close();
        process.exit(0);
      });
    });
}
