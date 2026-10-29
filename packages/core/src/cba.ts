import { EventEmitter } from 'node:events';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { loadConfig } from './config/loader.js';
import { type CBAConfig } from './config/schema.js';
import { pathHash } from './utils/hash.js';
import type { CBAEvents, CBAEventName } from './utils/events.js';
import { NotIndexedError } from './utils/errors.js';
import { scanDirectory, filterChangedFiles, type ScannedFile } from './indexer/scanner.js';
import { chunkFile, type CodeChunk } from './indexer/chunker.js';
import { Embedder } from './indexer/embedder.js';
import { VectorStore } from './indexer/store.js';
import { searchCodebase, type SearchOptions, type SearchResult } from './retriever/search.js';
import { buildPromptContext } from './retriever/context-builder.js';
import { LLMClient } from './llm/client.js';
import { explainResults, type ExplainedSearchResult } from './llm/explain.js';
import { SYSTEM_ASK, buildAskPrompt } from './llm/prompts.js';
import { ChatSession, type ChatResult, type ChatStreamEvent, type ChatOptions } from './llm/chat.js';
import { MemoryStore } from './memory/store.js';
import { extractFacts } from './memory/extractor.js';

export interface CBAOptions {
  projectPath: string;
  config?: Partial<CBAConfig>;
  dataDir?: string;
}

export interface IndexOptions {
  excludePatterns?: string[];
  includeExtensions?: string[];
  maxFileSize?: number;
}

export interface IndexResult {
  totalFiles: number;
  totalChunks: number;
  newFiles: number;
  changedFiles: number;
  removedFiles: number;
  durationMs: number;
}

export interface SearchAndExplainOptions extends SearchOptions {
  model?: string;
}

export interface AskOptions {
  contextChunks?: number;
  model?: string;
  showSources?: boolean;
}

export interface AskResult {
  answer: string;
  sources: SearchResult[];
  inputTokens: number;
  outputTokens: number;
}

export interface ExplainOptions {
  model?: string;
}

export interface ExplainResult {
  explanation: string;
  sources: SearchResult[];
  inputTokens: number;
  outputTokens: number;
}

export interface ProjectStatus {
  projectPath: string;
  projectName: string;
  indexed: boolean;
  totalChunks: number;
  totalFiles: number;
  lastIndexed?: number;
  dataDir: string;
}

export interface ProjectInfo {
  projectPath: string;
  projectName: string;
  hash: string;
  lastIndexed?: number;
}

interface ProjectMeta {
  projectPath: string;
  projectName: string;
  lastIndexed?: number;
  fileHashes: Record<string, string>;
}

export class CBA extends EventEmitter {
  readonly projectPath: string;
  readonly memory: MemoryStore;

  private config!: CBAConfig;
  private projectDataDir!: string;
  private embedder!: Embedder;
  private store!: VectorStore;
  private llmClient!: LLMClient;
  private chatSessions = new Map<string, ChatSession>();
  private initialized = false;
  private configOverrides?: Partial<CBAConfig>;
  private dataDirOverride?: string;

  constructor(options: CBAOptions) {
    super();
    this.projectPath = resolve(options.projectPath);
    this.configOverrides = options.config;
    this.dataDirOverride = options.dataDir;

    const hash = pathHash(this.projectPath);
    const dataDir = options.dataDir ?? options.config?.dataDir ?? join(process.env['HOME'] ?? '', '.cba');
    this.projectDataDir = join(dataDir, 'data', hash);
    this.memory = new MemoryStore(this.projectDataDir);
  }

  private async init(): Promise<void> {
    if (this.initialized) return;

    this.config = await loadConfig({
      ...this.configOverrides,
      dataDir: this.dataDirOverride ?? this.configOverrides?.dataDir,
    });

    const hash = pathHash(this.projectPath);
    const dataDir = this.config.dataDir ?? join(process.env['HOME'] ?? '', '.cba');
    this.projectDataDir = join(dataDir, 'data', hash);

    await mkdir(this.projectDataDir, { recursive: true });

    this.store = new VectorStore(this.projectDataDir);
    await this.store.initialize();

    this.embedder = new Embedder(this.config);

    if (this.config.xaiApiKey) {
      this.llmClient = new LLMClient(this.config);
    }

    await this.memory.load();
    this.initialized = true;
  }

  // ── Indexing ──────────────────────────────────────────────

  async index(options?: IndexOptions): Promise<IndexResult> {
    await this.init();
    const start = Date.now();

    // Load existing metadata
    const meta = await this.loadProjectMeta();
    const existingHashes = new Map(Object.entries(meta.fileHashes));

    // Scan files
    const scanned = await scanDirectory(this.projectPath, {
      excludePatterns: options?.excludePatterns ?? this.config.indexing.excludePatterns,
      includeExtensions: options?.includeExtensions ?? this.config.indexing.includeExtensions,
      maxFileSize: options?.maxFileSize ?? this.config.indexing.maxFileSize,
    });

    this.emit('index:start', { totalFiles: scanned.length });

    // Filter changed files
    const { changed, unchanged, removed } = filterChangedFiles(scanned, existingHashes);

    // Remove chunks for deleted files
    if (removed.length > 0) {
      const removedAbsolute = removed.map(r => join(this.projectPath, r));
      await this.store.deleteByFilePaths(removedAbsolute);
    }

    // Chunk changed files
    let totalChunks = 0;
    const allChunks: CodeChunk[] = [];

    for (let i = 0; i < changed.length; i++) {
      const file = changed[i]!;
      this.emit('index:file', {
        filePath: file.relativePath,
        current: i + 1,
        total: changed.length,
      });

      try {
        const chunks = await chunkFile(
          file.content,
          file.relativePath,
          file.extension,
          { maxChunkTokens: this.config.indexing.maxChunkTokens }
        );
        allChunks.push(...chunks);
        totalChunks += chunks.length;
        this.emit('index:chunk', { filePath: file.relativePath, chunkCount: chunks.length });
      } catch (err) {
        this.emit('index:error', { filePath: file.relativePath, error: err as Error });
      }
    }

    // Embed in batches
    if (allChunks.length > 0) {
      const batchSize = this.config.indexing.batchSize;
      const totalBatches = Math.ceil(allChunks.length / batchSize);

      for (let batch = 0; batch < totalBatches; batch++) {
        const batchChunks = allChunks.slice(batch * batchSize, (batch + 1) * batchSize);
        this.emit('index:embed', {
          batch: batch + 1,
          totalBatches,
          chunkCount: batchChunks.length,
        });

        const embeddings = await this.embedder.embedChunks(batchChunks);
        await this.store.upsert(batchChunks, embeddings);
        this.emit('index:store', { chunkCount: batchChunks.length });
      }
    }

    // Update metadata
    const newHashes: Record<string, string> = {};
    for (const file of scanned) {
      newHashes[file.relativePath] = file.contentHash;
    }

    await this.saveProjectMeta({
      projectPath: this.projectPath,
      projectName: this.projectPath.split('/').pop() ?? 'unknown',
      lastIndexed: Date.now(),
      fileHashes: newHashes,
    });

    const durationMs = Date.now() - start;
    this.emit('index:complete', {
      totalFiles: scanned.length,
      totalChunks,
      durationMs,
    });

    return {
      totalFiles: scanned.length,
      totalChunks,
      newFiles: changed.filter(f => !existingHashes.has(f.relativePath)).length,
      changedFiles: changed.filter(f => existingHashes.has(f.relativePath)).length,
      removedFiles: removed.length,
      durationMs,
    };
  }

  async reindex(options?: IndexOptions): Promise<IndexResult> {
    await this.init();
    // Clear existing metadata to force full re-index
    await this.saveProjectMeta({
      projectPath: this.projectPath,
      projectName: this.projectPath.split('/').pop() ?? 'unknown',
      fileHashes: {},
    });
    return this.index(options);
  }

  // ── Search ────────────────────────────────────────────────

  async search(query: string, options?: SearchOptions): Promise<SearchResult[]> {
    await this.init();
    await this.ensureIndexed();
    return searchCodebase(query, this.embedder, this.store, this.config, options);
  }

  async searchAndExplain(
    query: string,
    options?: SearchAndExplainOptions
  ): Promise<ExplainedSearchResult[]> {
    await this.init();
    await this.ensureIndexed();

    const results = await searchCodebase(query, this.embedder, this.store, this.config, options);
    this.emit('search:results', { count: results.length, durationMs: 0 });

    if (results.length === 0) return [];

    return explainResults(query, results, this.llmClient, options?.model);
  }

  // ── Ask ───────────────────────────────────────────────────

  async ask(question: string, options?: AskOptions): Promise<AskResult> {
    await this.init();
    await this.ensureIndexed();

    const results = await searchCodebase(question, this.embedder, this.store, this.config, {
      limit: options?.contextChunks ?? 10,
    });

    const { context } = buildPromptContext(results);
    const prompt = buildAskPrompt(question, context);

    const response = await this.llmClient.complete(
      [{ role: 'user', content: prompt }],
      { system: SYSTEM_ASK, model: options?.model }
    );

    return {
      answer: response.content,
      sources: results,
      inputTokens: response.inputTokens,
      outputTokens: response.outputTokens,
    };
  }

  // ── Explain ───────────────────────────────────────────────

  async explain(
    query: string,
    chunks?: CodeChunk[],
    options?: ExplainOptions
  ): Promise<ExplainResult> {
    await this.init();
    await this.ensureIndexed();

    // If no chunks provided, search for relevant ones
    let searchResults: SearchResult[];
    if (!chunks) {
      searchResults = await searchCodebase(query, this.embedder, this.store, this.config, {
        limit: 15,
      });
    } else {
      searchResults = chunks.map((c, i) => ({
        ...c,
        score: 1,
        rank: i + 1,
      }));
    }

    const { context } = buildPromptContext(searchResults);

    const response = await this.llmClient.complete(
      [{ role: 'user', content: `Explain the following concept/pattern in this codebase: "${query}"\n\nCode context:\n${context}` }],
      { system: SYSTEM_ASK, model: options?.model }
    );

    return {
      explanation: response.content,
      sources: searchResults,
      inputTokens: response.inputTokens,
      outputTokens: response.outputTokens,
    };
  }

  // ── Chat ──────────────────────────────────────────────────

  async chat(
    message: string,
    conversationId?: string,
    options?: ChatOptions
  ): Promise<ChatResult> {
    await this.init();
    await this.ensureIndexed();

    const session = this.getOrCreateSession(conversationId);

    const results = await searchCodebase(message, this.embedder, this.store, this.config, {
      limit: 10,
    });

    const memoryContext = options?.includeMemory !== false
      ? await this.memory.getRelevant(message)
      : undefined;

    const result = await session.chat(message, results, this.llmClient, options, memoryContext);

    // Auto-extract facts if enabled
    if (options?.includeMemory !== false && session.getHistory().length % 4 === 0) {
      this.autoExtractMemory(session).catch(() => {});
    }

    return result;
  }

  async *chatStream(
    message: string,
    conversationId?: string,
    options?: ChatOptions
  ): AsyncIterable<ChatStreamEvent> {
    await this.init();
    await this.ensureIndexed();

    const session = this.getOrCreateSession(conversationId);

    const results = await searchCodebase(message, this.embedder, this.store, this.config, {
      limit: 10,
    });

    const memoryContext = options?.includeMemory !== false
      ? await this.memory.getRelevant(message)
      : undefined;

    yield* session.chatStream(message, results, this.llmClient, options, memoryContext);
  }

  // ── Status ────────────────────────────────────────────────

  async getStatus(): Promise<ProjectStatus> {
    await this.init();
    const meta = await this.loadProjectMeta();
    const stats = await this.store.getStats();

    return {
      projectPath: this.projectPath,
      projectName: meta.projectName,
      indexed: stats.totalChunks > 0,
      totalChunks: stats.totalChunks,
      totalFiles: stats.totalFiles,
      lastIndexed: meta.lastIndexed,
      dataDir: this.projectDataDir,
    };
  }

  static async listProjects(dataDir?: string): Promise<ProjectInfo[]> {
    const { readdir } = await import('node:fs/promises');
    const dir = dataDir ?? join(process.env['HOME'] ?? '', '.cba', 'data');

    if (!existsSync(dir)) return [];

    const entries = await readdir(dir, { withFileTypes: true });
    const projects: ProjectInfo[] = [];

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const metaPath = join(dir, entry.name, 'project.json');
      if (!existsSync(metaPath)) continue;

      try {
        const raw = await readFile(metaPath, 'utf-8');
        const meta = JSON.parse(raw) as ProjectMeta;
        projects.push({
          projectPath: meta.projectPath,
          projectName: meta.projectName,
          hash: entry.name,
          lastIndexed: meta.lastIndexed,
        });
      } catch {
        // Skip corrupt
      }
    }

    return projects;
  }

  // ── Cleanup ───────────────────────────────────────────────

  async close(): Promise<void> {
    await this.store?.close();
    this.chatSessions.clear();
  }

  // ── Typed EventEmitter ────────────────────────────────────

  override emit<K extends CBAEventName>(event: K, data: CBAEvents[K]): boolean {
    return super.emit(event, data);
  }

  override on<K extends CBAEventName>(event: K, listener: (data: CBAEvents[K]) => void): this {
    return super.on(event, listener);
  }

  // ── Private helpers ───────────────────────────────────────

  private async ensureIndexed(): Promise<void> {
    const stats = await this.store.getStats();
    if (stats.totalChunks === 0) {
      throw new NotIndexedError(this.projectPath);
    }
  }

  private getOrCreateSession(conversationId?: string): ChatSession {
    if (conversationId) {
      const existing = this.chatSessions.get(conversationId);
      if (existing) return existing;
    }

    const session = new ChatSession(conversationId);
    this.chatSessions.set(session.conversationId, session);
    return session;
  }

  private async autoExtractMemory(session: ChatSession): Promise<void> {
    if (!this.llmClient) return;

    const history = session.getHistory();
    const recent = history.slice(-4);
    const conversation = recent.map(m => `${m.role}: ${m.content}`).join('\n\n');

    const facts = await extractFacts(conversation, this.llmClient);
    for (const fact of facts) {
      await this.memory.add(fact.fact, fact.category, 'auto');
      this.emit('memory:extract', { facts: [fact.fact] });
    }
  }

  private async loadProjectMeta(): Promise<ProjectMeta> {
    const metaPath = join(this.projectDataDir, 'project.json');
    if (!existsSync(metaPath)) {
      return {
        projectPath: this.projectPath,
        projectName: this.projectPath.split('/').pop() ?? 'unknown',
        fileHashes: {},
      };
    }

    try {
      const raw = await readFile(metaPath, 'utf-8');
      return JSON.parse(raw);
    } catch {
      return {
        projectPath: this.projectPath,
        projectName: this.projectPath.split('/').pop() ?? 'unknown',
        fileHashes: {},
      };
    }
  }

  private async saveProjectMeta(meta: ProjectMeta): Promise<void> {
    const metaPath = join(this.projectDataDir, 'project.json');
    await mkdir(this.projectDataDir, { recursive: true });
    await writeFile(metaPath, JSON.stringify(meta, null, 2) + '\n', 'utf-8');
  }
}
