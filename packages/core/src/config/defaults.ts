import { type CBAConfig } from './schema.js';
import { homedir } from 'node:os';
import { join } from 'node:path';

export const DEFAULT_DATA_DIR = join(homedir(), '.cba');

export const DEFAULT_CONFIG: CBAConfig = {
  dataDir: DEFAULT_DATA_DIR,
  indexing: {
    maxFileSize: 1_000_000,
    maxChunkTokens: 512,
    batchSize: 32,
    concurrency: 4,
    excludePatterns: [],
    includeExtensions: [],
  },
  search: {
    defaultLimit: 10,
    minScore: 0.1,
  },
  llm: {
    explainModel: 'claude-sonnet-4-20250514',
    chatModel: 'claude-sonnet-4-20250514',
    complexModel: 'claude-opus-4-20250514',
    maxTokens: 4096,
  },
  embedding: {
    model: 'Xenova/all-MiniLM-L6-v2',
    dimensions: 384,
  },
};

export const SUPPORTED_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
  '.py', '.pyi',
  '.go',
  '.rs',
  '.java',
  '.c', '.h', '.cpp', '.hpp', '.cc',
  '.cs',
  '.rb',
  '.php',
  '.swift',
  '.kt', '.kts',
  '.scala',
  '.sh', '.bash', '.zsh',
  '.sql',
  '.yaml', '.yml',
  '.json',
  '.toml',
  '.md', '.mdx',
  '.html', '.css', '.scss',
  '.vue', '.svelte',
]);

export const BINARY_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.ico', '.svg',
  '.woff', '.woff2', '.ttf', '.eot',
  '.pdf', '.zip', '.tar', '.gz',
  '.mp3', '.mp4', '.wav',
  '.exe', '.dll', '.so', '.dylib',
  '.pyc', '.pyo', '.class',
  '.o', '.obj', '.a', '.lib',
  '.lock',
]);

export const IGNORE_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', 'out',
  '.next', '.nuxt', '.svelte-kit',
  '__pycache__', '.pytest_cache', '.mypy_cache',
  'target', 'vendor',
  '.idea', '.vscode',
  'coverage', '.nyc_output',
  '.turbo', '.cache',
]);
