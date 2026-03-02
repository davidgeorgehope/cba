import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { CBAConfigSchema, type CBAConfig } from './schema.js';
import { DEFAULT_DATA_DIR } from './defaults.js';
import { ConfigError } from '../utils/errors.js';

export async function loadConfig(overrides?: Partial<CBAConfig>): Promise<CBAConfig> {
  const dataDir = overrides?.dataDir ?? process.env['CBA_DATA_DIR'] ?? DEFAULT_DATA_DIR;
  const configPath = join(dataDir, 'config.json');

  let fileConfig: Record<string, unknown> = {};
  if (existsSync(configPath)) {
    try {
      const raw = await readFile(configPath, 'utf-8');
      fileConfig = JSON.parse(raw);
    } catch (err) {
      throw new ConfigError(`Failed to parse config at ${configPath}`, err);
    }
  }

  const envConfig: Record<string, unknown> = {};
  if (process.env['ANTHROPIC_API_KEY']) {
    envConfig.anthropicApiKey = process.env['ANTHROPIC_API_KEY'];
  }

  const merged = { ...fileConfig, ...envConfig, ...overrides, dataDir };

  try {
    return CBAConfigSchema.parse(merged);
  } catch (err) {
    throw new ConfigError('Invalid configuration', err);
  }
}

export async function saveConfig(config: Partial<CBAConfig>, dataDir?: string): Promise<void> {
  const dir = dataDir ?? DEFAULT_DATA_DIR;
  await mkdir(dir, { recursive: true });
  const configPath = join(dir, 'config.json');

  let existing: Record<string, unknown> = {};
  if (existsSync(configPath)) {
    try {
      existing = JSON.parse(await readFile(configPath, 'utf-8'));
    } catch {
      // Start fresh
    }
  }

  const merged = { ...existing, ...config };
  // Don't save env-derived keys to file
  delete merged.anthropicApiKey;


  await writeFile(configPath, JSON.stringify(merged, null, 2) + '\n', 'utf-8');
}

export async function initConfig(dataDir?: string): Promise<string> {
  const dir = dataDir ?? DEFAULT_DATA_DIR;
  await mkdir(dir, { recursive: true });
  await mkdir(join(dir, 'data'), { recursive: true });

  const configPath = join(dir, 'config.json');
  if (!existsSync(configPath)) {
    await writeFile(configPath, JSON.stringify({}, null, 2) + '\n', 'utf-8');
  }

  return dir;
}
