import { Command } from 'commander';
import chalk from 'chalk';
import { loadConfig, saveConfig, initConfig } from '@cba/core';

export function registerConfigCommand(program: Command): void {
  const config = program
    .command('config')
    .description('View/update configuration');

  config
    .command('show')
    .description('Show current configuration')
    .action(async () => {
      const jsonOutput = (program.opts() as { json?: boolean }).json;

      try {
        const cfg = await loadConfig();
        const display = {
          ...cfg,
          anthropicApiKey: cfg.anthropicApiKey ? '***' + cfg.anthropicApiKey.slice(-4) : undefined,
        };

        if (jsonOutput) {
          console.log(JSON.stringify(display, null, 2));
        } else {
          console.log(chalk.bold('Configuration:\n'));
          console.log(JSON.stringify(display, null, 2));
        }
      } catch (err) {
        console.error(chalk.red((err as Error).message));
        process.exitCode = 1;
      }
    });

  config
    .command('set <key> <value>')
    .description('Set a configuration value')
    .action(async (key: string, value: string) => {
      try {
        const parsed = tryParseValue(value);
        const update: Record<string, unknown> = {};

        // Handle nested keys like "llm.explainModel"
        const parts = key.split('.');
        if (parts.length === 1) {
          update[key] = parsed;
        } else {
          const nested: Record<string, unknown> = {};
          nested[parts[1]!] = parsed;
          update[parts[0]!] = nested;
        }

        await saveConfig(update as Parameters<typeof saveConfig>[0]);
        console.log(chalk.green(`Set ${key} = ${value}`));
      } catch (err) {
        console.error(chalk.red((err as Error).message));
        process.exitCode = 1;
      }
    });

  config
    .command('init')
    .description('Initialize CBA configuration directory')
    .action(async () => {
      try {
        const dir = await initConfig();
        console.log(chalk.green(`Initialized CBA at ${dir}`));
      } catch (err) {
        console.error(chalk.red((err as Error).message));
        process.exitCode = 1;
      }
    });
}

function tryParseValue(value: string): unknown {
  if (value === 'true') return true;
  if (value === 'false') return false;
  const num = Number(value);
  if (!isNaN(num)) return num;
  return value;
}
