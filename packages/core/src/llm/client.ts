import Anthropic from '@anthropic-ai/sdk';
import type { CBAConfig } from '../config/schema.js';
import { LLMError } from '../utils/errors.js';

export interface CompletionOptions {
  model?: string;
  maxTokens?: number;
  temperature?: number;
  system?: string;
}

export interface CompletionResult {
  content: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
}

export interface StreamEvent {
  type: 'text' | 'done';
  text?: string;
  result?: CompletionResult;
}

export class LLMClient {
  private client: Anthropic;
  private config: CBAConfig;

  constructor(config: CBAConfig) {
    if (!config.anthropicApiKey) {
      throw new LLMError('ANTHROPIC_API_KEY is required. Set it in env or config.');
    }
    this.client = new Anthropic({ apiKey: config.anthropicApiKey });
    this.config = config;
  }

  async complete(
    messages: Anthropic.MessageParam[],
    options?: CompletionOptions
  ): Promise<CompletionResult> {
    const model = options?.model ?? this.config.llm.explainModel;
    const maxTokens = options?.maxTokens ?? this.config.llm.maxTokens;

    try {
      const response = await this.client.messages.create({
        model,
        max_tokens: maxTokens,
        system: options?.system,
        messages,
      });

      const content = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === 'text')
        .map(b => b.text)
        .join('');

      return {
        content,
        model: response.model,
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      };
    } catch (err) {
      throw new LLMError(`LLM completion failed: ${(err as Error).message}`, err);
    }
  }

  async *stream(
    messages: Anthropic.MessageParam[],
    options?: CompletionOptions
  ): AsyncIterable<StreamEvent> {
    const model = options?.model ?? this.config.llm.chatModel;
    const maxTokens = options?.maxTokens ?? this.config.llm.maxTokens;

    try {
      const stream = this.client.messages.stream({
        model,
        max_tokens: maxTokens,
        system: options?.system,
        messages,
      });

      let inputTokens = 0;
      let outputTokens = 0;

      for await (const event of stream) {
        if (event.type === 'content_block_delta') {
          const delta = event.delta;
          if ('text' in delta) {
            yield { type: 'text', text: delta.text };
          }
        } else if (event.type === 'message_delta') {
          outputTokens = event.usage.output_tokens;
        } else if (event.type === 'message_start') {
          inputTokens = event.message.usage.input_tokens;
        }
      }

      yield {
        type: 'done',
        result: { content: '', model, inputTokens, outputTokens },
      };
    } catch (err) {
      throw new LLMError(`LLM stream failed: ${(err as Error).message}`, err);
    }
  }
}
