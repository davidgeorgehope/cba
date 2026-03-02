import { Command } from 'commander';
import { registerIndexCommand } from './commands/index.js';
import { registerSearchCommand } from './commands/search.js';
import { registerAskCommand } from './commands/ask.js';
import { registerChatCommand } from './commands/chat.js';
import { registerStatusCommand } from './commands/status.js';
import { registerMemoryCommand } from './commands/memory.js';
import { registerMcpCommand } from './commands/mcp.js';
import { registerConfigCommand } from './commands/config.js';

export function createProgram(): Command {
  const program = new Command();

  program
    .name('cba')
    .description('Codebase Agent — semantic code search and explanation tool')
    .version('0.1.0')
    .option('-p, --project <path>', 'Project path', process.cwd())
    .option('--json', 'Machine-readable JSON output')
    .option('--no-color', 'Disable colors')
    .option('--verbose', 'Verbose logging');

  registerIndexCommand(program);
  registerSearchCommand(program);
  registerAskCommand(program);
  registerChatCommand(program);
  registerStatusCommand(program);
  registerMemoryCommand(program);
  registerMcpCommand(program);
  registerConfigCommand(program);

  return program;
}
