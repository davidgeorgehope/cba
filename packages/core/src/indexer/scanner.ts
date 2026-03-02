import { readdir, readFile, stat } from 'node:fs/promises';
import { join, relative, extname, basename } from 'node:path';
import { existsSync } from 'node:fs';
import ignore, { type Ignore } from 'ignore';
import { contentHash } from '../utils/hash.js';
import { SUPPORTED_EXTENSIONS, BINARY_EXTENSIONS, IGNORE_DIRS } from '../config/defaults.js';
import type { CBAConfig } from '../config/schema.js';

export interface ScannedFile {
  absolutePath: string;
  relativePath: string;
  extension: string;
  contentHash: string;
  sizeBytes: number;
  content: string;
}

export interface ScanOptions {
  excludePatterns?: string[];
  includeExtensions?: string[];
  maxFileSize?: number;
}

export async function scanDirectory(
  projectPath: string,
  options?: ScanOptions
): Promise<ScannedFile[]> {
  const maxSize = options?.maxFileSize ?? 1_000_000;
  const includeExts = options?.includeExtensions?.length
    ? new Set(options.includeExtensions.map(e => e.startsWith('.') ? e : `.${e}`))
    : SUPPORTED_EXTENSIONS;

  const ig = await loadGitignore(projectPath);
  if (options?.excludePatterns) {
    ig.add(options.excludePatterns);
  }

  const files: ScannedFile[] = [];
  await walkDir(projectPath, projectPath, ig, includeExts, maxSize, files);
  return files;
}

async function walkDir(
  root: string,
  dir: string,
  ig: Ignore,
  includeExts: Set<string>,
  maxSize: number,
  results: ScannedFile[]
): Promise<void> {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    const relPath = relative(root, fullPath);

    if (entry.isDirectory()) {
      if (IGNORE_DIRS.has(entry.name)) continue;
      if (ig.ignores(relPath + '/')) continue;
      await walkDir(root, fullPath, ig, includeExts, maxSize, results);
      continue;
    }

    if (!entry.isFile()) continue;

    const ext = extname(entry.name).toLowerCase();
    if (BINARY_EXTENSIONS.has(ext)) continue;
    if (!includeExts.has(ext)) continue;
    if (ig.ignores(relPath)) continue;
    if (basename(entry.name).startsWith('.')) continue;

    try {
      const stats = await stat(fullPath);
      if (stats.size > maxSize || stats.size === 0) continue;

      const content = await readFile(fullPath, 'utf-8');
      const hash = contentHash(content);

      results.push({
        absolutePath: fullPath,
        relativePath: relPath,
        extension: ext,
        contentHash: hash,
        sizeBytes: stats.size,
        content,
      });
    } catch {
      // Skip files we can't read
    }
  }
}

async function loadGitignore(projectPath: string): Promise<Ignore> {
  const ig = ignore();
  const gitignorePath = join(projectPath, '.gitignore');

  if (existsSync(gitignorePath)) {
    try {
      const content = await readFile(gitignorePath, 'utf-8');
      ig.add(content);
    } catch {
      // Skip
    }
  }

  // Always ignore common dirs
  ig.add(['.git', 'node_modules']);

  return ig;
}

export function filterChangedFiles(
  scanned: ScannedFile[],
  existingHashes: Map<string, string>
): { changed: ScannedFile[]; unchanged: string[]; removed: string[] } {
  const changed: ScannedFile[] = [];
  const unchanged: string[] = [];
  const currentPaths = new Set(scanned.map(f => f.relativePath));

  for (const file of scanned) {
    const existingHash = existingHashes.get(file.relativePath);
    if (existingHash && existingHash === file.contentHash) {
      unchanged.push(file.relativePath);
    } else {
      changed.push(file);
    }
  }

  const removed = [...existingHashes.keys()].filter(p => !currentPaths.has(p));
  return { changed, unchanged, removed };
}
