import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { existsSync } from 'node:fs';

export interface MemoryEntry {
  id: string;
  fact: string;
  source: 'auto' | 'user' | 'agent';
  category: string;
  createdAt: number;
  updatedAt: number;
}

export class MemoryStore {
  private entries: MemoryEntry[] = [];
  private filePath: string;
  private loaded = false;

  constructor(projectDataDir: string) {
    this.filePath = join(projectDataDir, 'memory.json');
  }

  async load(): Promise<void> {
    if (this.loaded) return;

    if (existsSync(this.filePath)) {
      try {
        const raw = await readFile(this.filePath, 'utf-8');
        this.entries = JSON.parse(raw);
      } catch {
        this.entries = [];
      }
    }
    this.loaded = true;
  }

  async save(): Promise<void> {
    const dir = join(this.filePath, '..');
    await mkdir(dir, { recursive: true });
    await writeFile(this.filePath, JSON.stringify(this.entries, null, 2) + '\n', 'utf-8');
  }

  async add(fact: string, category: string = 'general', source: 'auto' | 'user' | 'agent' = 'user'): Promise<MemoryEntry> {
    await this.load();

    const entry: MemoryEntry = {
      id: `mem_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      fact,
      source,
      category,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    this.entries.push(entry);
    await this.save();
    return entry;
  }

  async list(): Promise<MemoryEntry[]> {
    await this.load();
    return [...this.entries];
  }

  async search(query: string): Promise<MemoryEntry[]> {
    await this.load();
    const lower = query.toLowerCase();
    return this.entries.filter(e =>
      e.fact.toLowerCase().includes(lower) ||
      e.category.toLowerCase().includes(lower)
    );
  }

  async delete(id: string): Promise<boolean> {
    await this.load();
    const before = this.entries.length;
    this.entries = this.entries.filter(e => e.id !== id);
    if (this.entries.length < before) {
      await this.save();
      return true;
    }
    return false;
  }

  async clear(): Promise<void> {
    this.entries = [];
    await this.save();
  }

  async getRelevant(query: string, limit: number = 5): Promise<string> {
    const results = await this.search(query);
    if (results.length === 0) return '';

    return results
      .slice(0, limit)
      .map(e => `- ${e.fact}`)
      .join('\n');
  }
}
