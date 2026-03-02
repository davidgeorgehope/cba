import chalk from 'chalk';
import type { SearchResult, ExplainedSearchResult } from '@cba/core';

export function formatSearchResults(
  results: (SearchResult | ExplainedSearchResult)[],
  query: string
): string {
  if (results.length === 0) {
    return chalk.yellow(`No results found for "${query}"`);
  }

  const lines: string[] = [];
  lines.push(chalk.dim(`Found ${results.length} results for "${query}":\n`));

  for (const result of results) {
    const scoreColor = result.score > 0.8
      ? chalk.green
      : result.score > 0.5
        ? chalk.yellow
        : chalk.red;

    // Rank and score
    lines.push(
      `${chalk.bold.white(`#${result.rank}`)} ${scoreColor(`[${(result.score * 100).toFixed(0)}%]`)} ` +
      chalk.bold.white(`${result.filePath}`) +
      chalk.dim(`:${result.startLine + 1}-${result.endLine + 1}`)
    );

    // Chunk type and symbol
    lines.push(
      chalk.cyan(`  ${result.chunkType}: ${result.symbolName}`) +
      (result.parentSymbol ? chalk.dim(` (in ${result.parentSymbol})`) : '')
    );

    // Code snippet (first 5 lines)
    const codeLines = result.content.split('\n').slice(0, 5);
    for (const line of codeLines) {
      lines.push(chalk.dim('  │ ') + line);
    }
    if (result.content.split('\n').length > 5) {
      lines.push(chalk.dim('  │ ...'));
    }

    // Explanation (if present)
    if ('explanation' in result && result.explanation) {
      lines.push(chalk.magenta(`  > ${result.explanation}`));
    }

    lines.push('');
  }

  return lines.join('\n');
}

export function formatSearchResultsJson(
  results: (SearchResult | ExplainedSearchResult)[]
): string {
  return JSON.stringify(results.map(r => ({
    rank: r.rank,
    score: r.score,
    filePath: r.filePath,
    startLine: r.startLine + 1,
    endLine: r.endLine + 1,
    chunkType: r.chunkType,
    symbolName: r.symbolName,
    content: r.content,
    ...('explanation' in r ? { explanation: r.explanation } : {}),
  })), null, 2);
}
