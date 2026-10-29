import OpenAI from 'openai';
import type { CBAConfig } from '../config/schema.js';
import { LLMError } from '../utils/errors.js';

export interface LLMMessage {
  role: 'user' | 'assistant';
  content: string;
}

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
  private client: OpenAI;
  private config: CBAConfig;

  constructor(config: CBAConfig) {
    if (!config.xaiApiKey) {
      throw new LLMError('XAI_API_KEY is required. Set it in env or config.');
    }
    this.client = new OpenAI({ apiKey: config.xaiApiKey, baseURL: 'https://api.x.ai/v1' });
    this.config = config;
  }

  async complete(
    messages: LLMMessage[],
    options?: CompletionOptions
  ): Promise<CompletionResult> {
    const model = options?.model ?? this.config.llm.explainModel;
    const maxTokens = options?.maxTokens ?? this.config.llm.maxTokens;

    try {
      const response = await this.client.chat.completions.create({
        model,
        max_tokens: maxTokens,
        messages: withSystem(messages, options?.system),
      });

      return {
        content: response.choices[0]?.message?.content ?? '',
        model: response.model,
        inputTokens: response.usage?.prompt_tokens ?? 0,
        outputTokens: response.usage?.completion_tokens ?? 0,
      };
    } catch (err) {
      throw new LLMError(`LLM completion failed: ${(err as Error).message}`, err);
    }
  }

  async *stream(
    messages: LLMMessage[],
    options?: CompletionOptions
  ): AsyncIterable<StreamEvent> {
    const model = options?.model ?? this.config.llm.chatModel;
    const maxTokens = options?.maxTokens ?? this.config.llm.maxTokens;

    try {
      const stream = await this.client.chat.completions.create({
        model,
        max_tokens: maxTokens,
        messages: withSystem(messages, options?.system),
        stream: true,
        stream_options: { include_usage: true },
        reasoning_effort: 'low', // interactive chat: keep latency down
      });

      let inputTokens = 0;
      let outputTokens = 0;

      for await (const chunk of stream) {
        const text = chunk.choices[0]?.delta?.content;
        if (text) {
          yield { type: 'text', text };
        }
        if (chunk.usage) {
          inputTokens = chunk.usage.prompt_tokens;
          outputTokens = chunk.usage.completion_tokens;
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

function withSystem(
  messages: LLMMessage[],
  system?: string
): OpenAI.Chat.ChatCompletionMessageParam[] {
  return system ? [{ role: 'system', content: system }, ...messages] : messages;
}
