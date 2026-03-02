export class CBAError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = 'CBAError';
  }
}

export class NotIndexedError extends CBAError {
  constructor(projectPath: string) {
    super(
      `Project not indexed: ${projectPath}. Run 'cba index' first.`,
      'NOT_INDEXED'
    );
    this.name = 'NotIndexedError';
  }
}

export class ConfigError extends CBAError {
  constructor(message: string, cause?: unknown) {
    super(message, 'CONFIG_ERROR', cause);
    this.name = 'ConfigError';
  }
}

export class EmbeddingError extends CBAError {
  constructor(message: string, cause?: unknown) {
    super(message, 'EMBEDDING_ERROR', cause);
    this.name = 'EmbeddingError';
  }
}

export class LLMError extends CBAError {
  constructor(message: string, cause?: unknown) {
    super(message, 'LLM_ERROR', cause);
    this.name = 'LLMError';
  }
}

export class ParserError extends CBAError {
  constructor(message: string, cause?: unknown) {
    super(message, 'PARSER_ERROR', cause);
    this.name = 'ParserError';
  }
}

export class StoreError extends CBAError {
  constructor(message: string, cause?: unknown) {
    super(message, 'STORE_ERROR', cause);
    this.name = 'StoreError';
  }
}
