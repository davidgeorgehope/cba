import { Command } from 'commander';
import chalk from 'chalk';
import { CBA } from '@cba/core';

export function registerMemoryCommand(program: Command): void {
  const memory = program
    .command('memory')
    .description('Manage codebase memory');

  memory
    .command('list')
    .description('List all memory entries')
    .action(async () => {
      const projectPath = (program.opts() as { project: string }).project;
      const jsonOutput = (program.opts() as { json?: boolean }).json;
      const cba = new CBA({ projectPath });

      try {
        const entries = await cba.memory.list();

        if (jsonOutput) {
          console.log(JSON.stringify(entries, null, 2));
          return;
        }

        if (entries.length === 0) {
          console.log(chalk.dim('No memories stored.'));
          return;
        }

        console.log(chalk.bold(`Memories (${entries.length}):\n`));
        for (const entry of entries) {
          console.log(`  ${chalk.cyan(`[${entry.category}]`)} ${entry.fact}`);
          console.log(chalk.dim(`    ID: ${entry.id} | Source: ${entry.source} | ${new Date(entry.createdAt).toLocaleDateString()}`));
        }
      } finally {
        await cba.close();
      }
    });

  memory
    .command('search <query>')
    .description('Search memory entries')
    .action(async (query: string) => {
      const projectPath = (program.opts() as { project: string }).project;
      const jsonOutput = (program.opts() as { json?: boolean }).json;
      const cba = new CBA({ projectPath });

      try {
        const entries = await cba.memory.search(query);

        if (jsonOutput) {
          console.log(JSON.stringify(entries, null, 2));
          return;
        }

        if (entries.length === 0) {
          console.log(chalk.dim(`No memories matching "${query}".`));
          return;
        }

        for (const entry of entries) {
          console.log(`  ${chalk.cyan(`[${entry.category}]`)} ${entry.fact}`);
          console.log(chalk.dim(`    ID: ${entry.id}`));
        }
      } finally {
        await cba.close();
      }
    });

  memory
    .command('add <fact>')
    .description('Add a memory entry')
    .option('-c, --category <category>', 'Category', 'general')
    .action(async (fact: string, opts: Record<string, unknown>) => {
      const projectPath = (program.opts() as { project: string }).project;
      const cba = new CBA({ projectPath });

      try {
        const entry = await cba.memory.add(fact, opts['category'] as string);
        console.log(chalk.green(`Memory added: ${entry.id}`));
      } finally {
        await cba.close();
      }
    });

  memory
    .command('delete <id>')
    .description('Delete a memory entry')
    .action(async (id: string) => {
      const projectPath = (program.opts() as { project: string }).project;
      const cba = new CBA({ projectPath });

      try {
        const deleted = await cba.memory.delete(id);
        if (deleted) {
          console.log(chalk.green('Memory deleted.'));
        } else {
          console.log(chalk.yellow('Memory not found.'));
        }
      } finally {
        await cba.close();
      }
    });

  memory
    .command('clear')
    .description('Clear all memory entries')
    .action(async () => {
      const projectPath = (program.opts() as { project: string }).project;
      const cba = new CBA({ projectPath });

      try {
        await cba.memory.clear();
        console.log(chalk.green('All memories cleared.'));
      } finally {
        await cba.close();
      }
    });
}
