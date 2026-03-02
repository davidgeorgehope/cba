import chalk from 'chalk';

export function renderMarkdown(text: string): string {
  // Simple terminal markdown rendering
  let result = text;

  // Bold
  result = result.replace(/\*\*(.+?)\*\*/g, chalk.bold('$1'));

  // Inline code
  result = result.replace(/`([^`]+)`/g, chalk.cyan('$1'));

  // Code blocks (just indent them)
  result = result.replace(/```[\w]*\n([\s\S]*?)```/g, (_match, code: string) => {
    return code
      .split('\n')
      .map((line: string) => chalk.dim('  │ ') + line)
      .join('\n');
  });

  // Headers
  result = result.replace(/^### (.+)$/gm, chalk.bold.cyan('  $1'));
  result = result.replace(/^## (.+)$/gm, chalk.bold.yellow('$1'));
  result = result.replace(/^# (.+)$/gm, chalk.bold.white('$1'));

  // Bullet points
  result = result.replace(/^- (.+)$/gm, chalk.dim('  • ') + '$1');

  return result;
}
