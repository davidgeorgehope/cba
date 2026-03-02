import { connect, type Connection, type Table } from '@lancedb/lancedb';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { StoreError } from '../utils/errors.js';
import type { CodeChunk } from './chunker.js';
import type { EmbeddingResult } from './embedder.js';

export interface StoredChunk {
  id: string;
  filePath: string;
  startLine: number;
  endLine: number;
  content: string;
  chunkType: string;
  symbolName: string;
  parentSymbol: string;
  language: string;
  tokenEstimate: number;
  vector: number[];
}

export interface VectorSearchResult {
  chunk: StoredChunk;
  score: number;
}

export interface SearchFilter {
  filePath?: string;
  language?: string;
  chunkType?: string;
  pathGlob?: string;
}

export class VectorStore {
  private db: Connection | null = null;
  private table: Table | null = null;
  private dbPath: string;
  private tableName = 'chunks';

  constructor(projectDataDir: string) {
    this.dbPath = join(projectDataDir, 'vectors.lance');
  }

  async initialize(): Promise<void> {
    try {
      await mkdir(this.dbPath, { recursive: true });
      this.db = await connect(this.dbPath);

      // Check if table exists
      const tables = await this.db.tableNames();
      if (tables.includes(this.tableName)) {
        this.table = await this.db.openTable(this.tableName);
      }
    } catch (err) {
      throw new StoreError('Failed to initialize LanceDB', err);
    }
  }

  async upsert(
    chunks: CodeChunk[],
    embeddings: EmbeddingResult[]
  ): Promise<number> {
    if (!this.db) throw new StoreError('Store not initialized');

    const embeddingMap = new Map(embeddings.map(e => [e.chunkId, e.embedding]));

    const records: StoredChunk[] = chunks
      .filter(c => embeddingMap.has(c.id))
      .map(c => ({
        id: c.id,
        filePath: c.filePath,
        startLine: c.startLine,
        endLine: c.endLine,
        content: c.content,
        chunkType: c.chunkType,
        symbolName: c.symbolName,
        parentSymbol: c.parentSymbol ?? '',
        language: c.language,
        tokenEstimate: c.tokenEstimate,
        vector: embeddingMap.get(c.id)!,
      }));

    if (records.length === 0) return 0;

    try {
      if (this.table) {
        // Delete existing chunks for the same files, then add new ones
        const filePaths = [...new Set(records.map(r => r.filePath))];
        for (const fp of filePaths) {
          try {
            await this.table.delete(`filePath = '${fp.replace(/'/g, "''")}'`);
          } catch {
            // Table might be empty or filter might not match
          }
        }
        await this.table.add(records as unknown as Record<string, unknown>[]);
      } else {
        this.table = await this.db.createTable(this.tableName, records as unknown as Record<string, unknown>[]);
      }

      return records.length;
    } catch (err) {
      throw new StoreError('Failed to upsert chunks', err);
    }
  }

  async search(
    queryVector: number[],
    limit: number = 10,
    filter?: SearchFilter
  ): Promise<VectorSearchResult[]> {
    if (!this.table) return [];

    try {
      let query = this.table.vectorSearch(queryVector).limit(limit);

      if (filter) {
        const conditions: string[] = [];
        if (filter.filePath) {
          conditions.push(`filePath = '${filter.filePath.replace(/'/g, "''")}'`);
        }
        if (filter.language) {
          conditions.push(`language = '${filter.language}'`);
        }
        if (filter.chunkType) {
          conditions.push(`chunkType = '${filter.chunkType}'`);
        }
        if (conditions.length > 0) {
          query = query.where(conditions.join(' AND '));
        }
      }

      const results = await query.toArray();

      return results.map((r: Record<string, unknown>) => ({
        chunk: {
          id: r['id'] as string,
          filePath: r['filePath'] as string,
          startLine: r['startLine'] as number,
          endLine: r['endLine'] as number,
          content: r['content'] as string,
          chunkType: r['chunkType'] as string,
          symbolName: r['symbolName'] as string,
          parentSymbol: r['parentSymbol'] as string,
          language: r['language'] as string,
          tokenEstimate: r['tokenEstimate'] as number,
          vector: r['vector'] as number[],
        },
        score: 1 - ((r['_distance'] as number) ?? 0),
      }));
    } catch (err) {
      throw new StoreError('Vector search failed', err);
    }
  }

  async deleteByFilePaths(filePaths: string[]): Promise<void> {
    if (!this.table || filePaths.length === 0) return;

    try {
      for (const fp of filePaths) {
        await this.table.delete(`filePath = '${fp.replace(/'/g, "''")}'`);
      }
    } catch (err) {
      throw new StoreError('Failed to delete chunks', err);
    }
  }

  async getFileHashes(): Promise<Map<string, string>> {
    // We store content hash in the chunk content, but for incremental we need
    // file-level hashes. We'll track these in project.json instead.
    return new Map();
  }

  async getStats(): Promise<{ totalChunks: number; totalFiles: number }> {
    if (!this.table) return { totalChunks: 0, totalFiles: 0 };

    try {
      const results = await this.table.countRows();
      // Approximate unique files
      const sample = await this.table.query().limit(10000).select(['filePath']).toArray();
      const files = new Set(sample.map((r: Record<string, unknown>) => r['filePath'] as string));
      return { totalChunks: results, totalFiles: files.size };
    } catch {
      return { totalChunks: 0, totalFiles: 0 };
    }
  }

  async close(): Promise<void> {
    this.db = null;
    this.table = null;
  }
}
