// The one interface Pip Core uses to call a text model, with the Bedrock and fake versions (PROJECT.md 5.2).
import { BedrockRuntimeClient, ConverseCommand } from '@aws-sdk/client-bedrock-runtime';

export interface CompleteInput {
  system: string;
  user: string;
  maxTokens: number;
  temperature: number;
  timeoutMs: number;
}

export interface TextModel {
  complete(input: CompleteInput): Promise<string>;
}

const MAX_ATTEMPTS = 2;

export class TimeoutError extends Error {
  constructor(ms: number) {
    super(`Timed out after ${ms} ms`);
    this.name = 'TimeoutError';
  }
}

/** Rejects with a TimeoutError if the promise has not settled after `ms`. */
export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new TimeoutError(ms)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/** A TextModel backed by Bedrock Converse. Takes plain values so core never reads the server config. */
export function createBedrockModel(options: {
  region: string;
  profile: string;
  modelId: string;
}): TextModel {
  const client = new BedrockRuntimeClient({
    region: options.region,
    profile: options.profile,
    maxAttempts: MAX_ATTEMPTS,
  });
  return {
    async complete(input) {
      const command = new ConverseCommand({
        modelId: options.modelId,
        system: [{ text: input.system }],
        messages: [{ role: 'user', content: [{ text: input.user }] }],
        inferenceConfig: { maxTokens: input.maxTokens, temperature: input.temperature },
      });
      const response = await withTimeout(
        client.send(command, { abortSignal: AbortSignal.timeout(input.timeoutMs) }),
        input.timeoutMs,
      );
      const parts = response.output?.message?.content ?? [];
      return parts.map((part) => part.text ?? '').join('');
    },
  };
}

/**
 * A TextModel backed by a local Ollama server (free, on the Mac). Used until the AWS account
 * works, and as a fallback brain for offline rehearsals.
 */
export function createOllamaModel(options: {
  url: string;
  model: string;
  fetch?: typeof fetch;
}): TextModel {
  const doFetch = options.fetch ?? fetch;
  return {
    async complete(input) {
      const response = await withTimeout(
        doFetch(`${options.url.replace(/\/+$/, '')}/api/chat`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          signal: AbortSignal.timeout(input.timeoutMs),
          body: JSON.stringify({
            model: options.model,
            stream: false,
            keep_alive: '30m',
            options: { temperature: input.temperature, num_predict: input.maxTokens },
            messages: [
              { role: 'system', content: input.system },
              { role: 'user', content: input.user },
            ],
          }),
        }),
        input.timeoutMs,
      );
      if (!response.ok) {
        const error = new Error(`Ollama answered HTTP ${response.status}`);
        error.name = 'OllamaHttpError';
        throw error;
      }
      const body = (await response.json()) as { message?: { content?: string } };
      return body.message?.content ?? '';
    },
  };
}

/** A TextModel for tests and AI_ENABLED=false: a fixed reply, or a function that may throw or hang. */
export function createFakeModel(
  reply: string | ((input: CompleteInput) => string | Promise<string>),
): TextModel {
  return {
    async complete(input) {
      return typeof reply === 'string' ? reply : reply(input);
    },
  };
}
