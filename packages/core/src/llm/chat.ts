import { LLMClient, type StreamEvent, type LLMMessage } from './client.js';
import { SYSTEM_CHAT, buildChatPrompt } from './prompts.js';
import { buildPromptContext } from '../retriever/context-builder.js';
import type { SearchResult } from '../retriever/search.js';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  sources?: SearchResult[];
  timestamp: number;
}

export interface ChatResult {
  content: string;
  sources: SearchResult[];
  conversationId: string;
  inputTokens: number;
  outputTokens: number;
}

export interface ChatStreamEvent {
  type: 'text' | 'sources' | 'done';
  text?: string;
  sources?: SearchResult[];
  result?: ChatResult;
}

export interface ChatOptions {
  model?: string;
  maxTokens?: number;
  includeMemory?: boolean;
}

export class ChatSession {
  private history: ChatMessage[] = [];
  readonly conversationId: string;

  constructor(conversationId?: string) {
    this.conversationId = conversationId ?? generateId();
  }

  addMessage(message: ChatMessage): void {
    this.history.push(message);
  }

  getHistory(): ChatMessage[] {
    return [...this.history];
  }

  buildMessages(
    userMessage: string,
    context: string,
    memory?: string
  ): LLMMessage[] {
    const messages: LLMMessage[] = [];

    // Include recent history (last 20 messages to stay within context)
    const recentHistory = this.history.slice(-20);
    for (const msg of recentHistory) {
      messages.push({ role: msg.role, content: msg.content });
    }

    // Current message with context
    const prompt = buildChatPrompt(userMessage, context, memory);
    messages.push({ role: 'user', content: prompt });

    return messages;
  }

  async chat(
    userMessage: string,
    searchResults: SearchResult[],
    llmClient: LLMClient,
    options?: ChatOptions,
    memory?: string
  ): Promise<ChatResult> {
    const { context } = buildPromptContext(searchResults);
    const messages = this.buildMessages(userMessage, context, memory);

    const response = await llmClient.complete(messages, {
      system: SYSTEM_CHAT,
      model: options?.model,
      maxTokens: options?.maxTokens,
    });

    this.addMessage({ role: 'user', content: userMessage, timestamp: Date.now() });
    this.addMessage({
      role: 'assistant',
      content: response.content,
      sources: searchResults,
      timestamp: Date.now(),
    });

    return {
      content: response.content,
      sources: searchResults,
      conversationId: this.conversationId,
      inputTokens: response.inputTokens,
      outputTokens: response.outputTokens,
    };
  }

  async *chatStream(
    userMessage: string,
    searchResults: SearchResult[],
    llmClient: LLMClient,
    options?: ChatOptions,
    memory?: string
  ): AsyncIterable<ChatStreamEvent> {
    const { context } = buildPromptContext(searchResults);
    const messages = this.buildMessages(userMessage, context, memory);

    yield { type: 'sources', sources: searchResults };

    let fullContent = '';

    for await (const event of llmClient.stream(messages, {
      system: SYSTEM_CHAT,
      model: options?.model,
      maxTokens: options?.maxTokens,
    })) {
      if (event.type === 'text' && event.text) {
        fullContent += event.text;
        yield { type: 'text', text: event.text };
      } else if (event.type === 'done') {
        this.addMessage({ role: 'user', content: userMessage, timestamp: Date.now() });
        this.addMessage({
          role: 'assistant',
          content: fullContent,
          sources: searchResults,
          timestamp: Date.now(),
        });

        yield {
          type: 'done',
          result: {
            content: fullContent,
            sources: searchResults,
            conversationId: this.conversationId,
            inputTokens: event.result?.inputTokens ?? 0,
            outputTokens: event.result?.outputTokens ?? 0,
          },
        };
      }
    }
  }

  clear(): void {
    this.history = [];
  }
}

function generateId(): string {
  return `chat_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
