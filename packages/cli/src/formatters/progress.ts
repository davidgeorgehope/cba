import ora, { type Ora } from 'ora';
import type { CBA } from '@cba/core';

export function attachProgressListeners(cba: CBA, spinner: Ora): void {
  cba.on('index:start', ({ totalFiles }) => {
    spinner.text = `Scanning ${totalFiles} files...`;
  });

  cba.on('index:file', ({ filePath, current, total }) => {
    spinner.text = `Parsing [${current}/${total}] ${filePath}`;
  });

  cba.on('index:embed', ({ batch, totalBatches, chunkCount }) => {
    spinner.text = `Embedding batch ${batch}/${totalBatches} (${chunkCount} chunks)...`;
  });

  cba.on('index:store', ({ chunkCount }) => {
    spinner.text = `Storing ${chunkCount} chunks...`;
  });

  cba.on('index:error', ({ filePath, error }) => {
    spinner.warn(`Error processing ${filePath}: ${error.message}`);
    spinner.start();
  });
}

export function createSpinner(text: string): Ora {
  return ora({ text, spinner: 'dots' });
}
