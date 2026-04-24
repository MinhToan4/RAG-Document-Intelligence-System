import { env } from '../../config/env.js';
import type { ChunkSearchResult } from '../../types/index.js';
import {
  detectQuestionLanguage,
  fallbackAnswerForLanguage,
  type SupportedQuestionLanguage,
} from '../../utils/language.js';
import { buildGroundedPrompt } from '../../utils/prompt.js';
import { logger } from '../../utils/logger.js';
import type { GenerationResult, IGenerationService } from './generation.service.interface.js';

type Provider = 'gemini' | 'groq';

type ChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
};

type GeminiGenerationResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
};

const MAX_RETRIES = 2;
const BASE_DELAY_MS = 600;
const FALLBACK_STATUS_CODES = new Set([403, 404, 408, 409, 429, 500, 502, 503, 504]);
function parseCsv(raw: string | undefined): string[] {
  if (!raw) {
    return [];
  }
  return raw
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function uniquePreserveOrder<T extends string>(values: T[]): T[] {
  const seen = new Set<T>();
  const ordered: T[] = [];
  for (const value of values) {
    if (seen.has(value)) {
      continue;
    }
    seen.add(value);
    ordered.push(value);
  }
  return ordered;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function extractStatusCode(error: unknown): number | null {
  if (!(error instanceof Error)) {
    return null;
  }
  const match = error.message.match(/Provider API error \((\d+)\):/);
  if (!match) {
    return null;
  }
  return Number(match[1]);
}

function canFallbackByError(error: unknown): boolean {
  if (error instanceof TypeError) {
    return true;
  }
  const status = extractStatusCode(error);
  return status !== null && FALLBACK_STATUS_CODES.has(status);
}

function shouldRetrySameModel(status: number): boolean {
  return status === 429 || status === 503;
}

async function fetchJson<T>(
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  context: { provider: Provider; model: string },
): Promise<T> {
  let lastMessage = 'Provider API error';

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    const response = await fetch(input, init);
    if (response.ok) {
      return (await response.json()) as T;
    }

    const payload = await response.text();
    lastMessage = `Provider API error (${response.status}): ${payload}`;

    if (!shouldRetrySameModel(response.status) || attempt === MAX_RETRIES) {
      throw new Error(lastMessage);
    }

    const retryDelayMs = BASE_DELAY_MS * 2 ** attempt;
    logger.warn('Transient provider error during generation. Retrying same model.', {
      ...context,
      status: response.status,
      attempt: attempt + 1,
      retryDelayMs,
    });
    await sleep(retryDelayMs);
  }

  throw new Error(lastMessage);
}

function normalizeProvider(raw: string | undefined): Provider | null {
  if (!raw) {
    return null;
  }
  const value = raw.trim().toLowerCase();
  if (value === 'gemini' || value === 'groq') {
    return value;
  }
  return null;
}

function buildProviderOrder(): Provider[] {
  const primary = env.AI_PROVIDER as Provider;
  const extra = parseCsv(env.LLM_FALLBACK_PROVIDERS)
    .map((item) => normalizeProvider(item))
    .filter((item): item is Provider => item !== null);

  // If no explicit fallback providers are configured, try remaining providers in deterministic order.
  const defaults: Provider[] =
    extra.length > 0 ? [] : (['gemini', 'groq'] as const).filter((provider) => provider !== primary);
  return uniquePreserveOrder([primary, ...extra, ...defaults]);
}

function buildModelOrder(provider: Provider): string[] {
  if (provider === 'groq') {
    return uniquePreserveOrder([env.GROQ_MODEL, ...parseCsv(env.GROQ_FALLBACK_MODELS)]);
  }
  return uniquePreserveOrder([env.LLM_MODEL, ...parseCsv(env.LLM_FALLBACK_MODELS)]);
}

function apiKeysForProvider(provider: Provider): string[] {
  if (provider === 'gemini') {
    const keys = [env.GEMINI_API_KEY];
    if (env.GEMINI_API_KEY_SECONDARY) {
      keys.push(env.GEMINI_API_KEY_SECONDARY);
    }
    return keys.filter((k): k is string => Boolean(k));
  }
  return env.GROQ_API_KEY ? [env.GROQ_API_KEY] : [];
}

export class GenerationServiceImpl implements IGenerationService {
  private warnedMockMode = false;

  async generateAnswer(
    question: string,
    chunks: ChunkSearchResult[],
    history?: Array<{ role: 'user' | 'assistant'; content: string }>,
    language?: SupportedQuestionLanguage,
  ): Promise<GenerationResult> {
    const answerLanguage = language ?? detectQuestionLanguage(question);
    const fallbackAnswer = fallbackAnswerForLanguage(answerLanguage);
    const prompt = buildGroundedPrompt(question, chunks, answerLanguage);

    const providerOrder = buildProviderOrder();
    for (let providerIndex = 0; providerIndex < providerOrder.length; providerIndex += 1) {
      const provider = providerOrder[providerIndex];
      const apiKeys = apiKeysForProvider(provider);
      const models = buildModelOrder(provider);

      if (apiKeys.length === 0) {
        logger.warn('Skipping provider due to missing API key.', { provider });
        continue;
      }

      for (let modelIndex = 0; modelIndex < models.length; modelIndex += 1) {
        const model = models[modelIndex];
        try {
          let lastError: Error | null = null;
          for (let keyIndex = 0; keyIndex < apiKeys.length; keyIndex += 1) {
            const apiKey = apiKeys[keyIndex];
            try {
              const answer =
                provider === 'gemini'
                  ? await this.generateWithGemini(prompt, apiKey, model, history, fallbackAnswer)
                  : await this.generateWithGroq(prompt, apiKey, model, history, fallbackAnswer);
              return { answer, model };
            } catch (error) {
              const status = extractStatusCode(error);
              if (status === 429 && keyIndex < apiKeys.length - 1) {
                logger.warn('API key rate limited. Trying next API key.', {
                  provider,
                  model,
                  keyIndex: keyIndex + 1,
                });
                lastError = error as Error;
                continue;
              }
              throw error;
            }
          }
          if (lastError) {
            throw lastError;
          }

        } catch (error) {
          const hasNextModel = modelIndex < models.length - 1;
          const hasNextProvider = providerIndex < providerOrder.length - 1;

          if (!canFallbackByError(error) || (!hasNextModel && !hasNextProvider)) {
            throw error;
          }

          logger.warn('Generation failed. Falling back to next model/provider.', {
            provider,
            model,
            hasNextModel,
            nextModel: hasNextModel ? models[modelIndex + 1] : null,
            hasNextProvider,
            nextProvider: hasNextProvider ? providerOrder[providerIndex + 1] : null,
            error: error instanceof Error ? error.message : String(error),
          });

          // Continue loop: next model same provider; if none, outer loop moves to next provider.
        }
      }
    }

    if (!this.warnedMockMode) {
      logger.warn('All configured generation providers failed. Returning mock response from top chunk.');
      this.warnedMockMode = true;
    }

    const topChunk = chunks[0];
    if (!topChunk) {
      return {
        answer: fallbackAnswer,
        model: 'mock',
      };
    }

    return {
      answer: [
        'All providers failed; this is a fallback response from nearest context.',
        '',
        `${topChunk.content.slice(0, 260)}...`,
        '',
        `[${topChunk.documentName} - ${topChunk.chunkIndex}]`,
      ].join('\n'),
      model: 'mock',
    };
  }

  private async generateWithGemini(
    prompt: string,
    apiKey: string,
    model: string,
    history?: Array<{ role: 'user' | 'assistant'; content: string }>,
    fallbackAnswer?: string,
  ): Promise<string> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const contents = (history || []).map((msg) => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }],
    }));

    contents.push({
      role: 'user',
      parts: [{ text: prompt }],
    });

    const payload = await fetchJson<GeminiGenerationResponse>(
      url,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents,
          generationConfig: {
            temperature: 0.2,
          },
        }),
      },
      { provider: 'gemini', model },
    );

    const text = payload.candidates?.[0]?.content?.parts?.map((part) => part.text ?? '').join('') ?? '';
    return text.trim() || fallbackAnswer || 'No relevant information was found in the provided documents.';
  }

  private async generateWithGroq(
    prompt: string,
    apiKey: string,
    model: string,
    history?: Array<{ role: 'user' | 'assistant'; content: string }>,
    fallbackAnswer?: string,
  ): Promise<string> {
    const messages: Array<{ role: string; content: string }> = [
      {
        role: 'system',
        content:
          'You answer strictly from provided context and follow the user prompt instructions exactly, including response language and exact fallback sentence.',
      },
    ];

    if (history) {
      messages.push(...history);
    }

    messages.push({
      role: 'user',
      content: prompt,
    });

    const payload = await fetchJson<ChatCompletionResponse>(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          temperature: 0.2,
          messages,
        }),
      },
      { provider: 'groq', model },
    );

    const text = payload.choices?.[0]?.message?.content?.trim();
    return text || fallbackAnswer || 'No relevant information was found in the provided documents.';
  }
}
