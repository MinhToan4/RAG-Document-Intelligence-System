/**
 * Service implementation for embedding operations. Encapsulates domain workflows and provider/repository integration.
 */
import { env } from '../../config/env.js';
import { logger } from '../../utils/logger.js';
import type { IEmbeddingService } from './embedding.service.interface.js';

function normalizeVector(values: number[]): number[] {
  const magnitude = Math.sqrt(values.reduce((acc, val) => acc + val * val, 0)) || 1;
  return values.map((value) => value / magnitude);
}

function buildMockEmbedding(text: string, dimension: number): number[] {
  const values = new Array(dimension).fill(0);
  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i);
    values[i % dimension] += ((code % 31) - 15) / 100;
  }
  return normalizeVector(values);
}

const MAX_RETRIES = 2;
const BASE_DELAY_MS = 600;

function shouldRetryStatus(status: number): boolean {
  return status === 429 || status === 503;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function fetchJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  let lastMessage = 'Provider API error';

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    const response = await fetch(input, init);
    if (response.ok) {
      return (await response.json()) as T;
    }

    const payload = await response.text();
    lastMessage = `Provider API error (${response.status}): ${payload}`;

    if (!shouldRetryStatus(response.status) || attempt === MAX_RETRIES) {
      throw new Error(lastMessage);
    }

    const retryDelayMs = BASE_DELAY_MS * 2 ** attempt;
    logger.warn('Transient provider error during embedding. Retrying request.', {
      status: response.status,
      attempt: attempt + 1,
      retryDelayMs,
      provider: env.AI_PROVIDER,
      model: env.EMBEDDING_MODEL,
    });
    await sleep(retryDelayMs);
  }

  throw new Error(lastMessage);
}

type GeminiEmbeddingResponse = {
  embedding?: {
    values?: number[];
  };
};

/**
 * Implementation of the Embedding Service.
 * Interfaces with AI providers (e.g., Gemini) to convert text into vector embeddings.
 * Includes a fallback mock mode for development without an API key.
 */
export class EmbeddingServiceImpl implements IEmbeddingService {
  private readonly dimension = env.EMBEDDING_DIM;
  private warnedMockMode = false;

  /**
   * Converts a single text string into a vector embedding.
   *
   * @param text - The text to embed
   * @returns A promise that resolves to an array of numbers representing the vector
   */
  async embedText(text: string): Promise<number[]> {
    const items = await this.embedTexts([text]);
    return items[0];
  }

  /**
   * Converts an array of text strings into an array of vector embeddings.
   * Handles API rate limiting and provides a mock implementation if the API key is missing.
   *
   * @param texts - An array of strings to embed
   * @returns A promise that resolves to a 2D array of numbers (array of vectors)
   */
  async embedTexts(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) {
      return [];
    }

    const apiKey = env.GEMINI_API_KEY;
    if (!apiKey) {
      if (!this.warnedMockMode) {
        logger.warn(
          'Missing API key. Embedding service is running in mock mode. Set API key to enable real embeddings.',
        );
        this.warnedMockMode = true;
      }
      return texts.map((text) => buildMockEmbedding(text, this.dimension));
    }

    return Promise.all(texts.map((text) => this.embedGemini(text, apiKey)));
  }

  /**
   * Private helper to invoke the Google Gemini Embedding API.
   *
   * @param text - The text to embed
   * @param apiKey - The Gemini API key
   * @returns A promise that resolves to the embedding vector
   */
  private async embedGemini(text: string, apiKey: string): Promise<number[]> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${env.EMBEDDING_MODEL}:embedContent?key=${apiKey}`;

    const payload = await fetchJson<GeminiEmbeddingResponse>(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: `models/${env.EMBEDDING_MODEL}`,
        content: {
          parts: [{ text }],
        },
        outputDimensionality: this.dimension,
      }),
    });

    const values = payload.embedding?.values;
    if (!values || values.length === 0) {
      throw new Error('Gemini embedding response is missing embedding values');
    }
    return values;
  }
}
