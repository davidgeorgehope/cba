import { createHash } from 'node:crypto';

export function contentHash(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

export function pathHash(absolutePath: string): string {
  return createHash('sha256').update(absolutePath).digest('hex').slice(0, 16);
}

export function chunkId(filePath: string, startLine: number, endLine: number): string {
  return createHash('sha256')
    .update(`${filePath}:${startLine}:${endLine}`)
    .digest('hex')
    .slice(0, 24);
}
