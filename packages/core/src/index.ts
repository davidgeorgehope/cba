// Main facade
export { CBA } from './cba.js';
export type {
  CBAOptions,
  IndexOptions,
  IndexResult,
  SearchAndExplainOptions,
  AskOptions,
  AskResult,
  ExplainOptions,
  ExplainResult,
  ProjectStatus,
  ProjectInfo,
} from './cba.js';

// Config
export { CBAConfigSchema } from './config/schema.js';
export type { CBAConfig } from './config/schema.js';
export { loadConfig, saveConfig, initConfig } from './config/loader.js';
export { DEFAULT_DATA_DIR, SUPPORTED_EXTENSIONS } from './config/defaults.js';

// Indexer
export type { ScannedFile } from './indexer/scanner.js';
export type { CodeChunk } from './indexer/chunker.js';
export { Embedder } from './indexer/embedder.js';
export { VectorStore } from './indexer/store.js';
export type { StoredChunk, VectorSearchResult, SearchFilter } from './indexer/store.js';

// Retriever
export type { SearchOptions, SearchResult } from './retriever/search.js';

// LLM
export { LLMClient } from './llm/client.js';
export type { ExplainedSearchResult } from './llm/explain.js';
export { ChatSession } from './llm/chat.js';
export type { ChatMessage, ChatResult, ChatStreamEvent, ChatOptions } from './llm/chat.js';

// Memory
export { MemoryStore } from './memory/store.js';
export type { MemoryEntry } from './memory/store.js';

// Utils
export { CBAError, NotIndexedError, ConfigError, EmbeddingError, LLMError, ParserError, StoreError } from './utils/errors.js';
export type { CBAEvents, CBAEventName } from './utils/events.js';
export { contentHash, pathHash, chunkId } from './utils/hash.js';
