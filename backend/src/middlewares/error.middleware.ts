import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../utils/app-error.js';
import { logger } from '../utils/logger.js';

function extractProviderStatus(message: string): number | null {
  const match = message.match(/^Provider API error \((\d{3})\):/);
  if (!match) {
    return null;
  }
  return Number(match[1]);
}

function extractProviderMessage(message: string): string {
  const splitIndex = message.indexOf(': ');
  if (splitIndex < 0) {
    return message;
  }

  const payload = message.slice(splitIndex + 2);
  try {
    const parsed = JSON.parse(payload) as { error?: { message?: string } };
    return parsed.error?.message?.trim() || message;
  } catch {
    return message;
  }
}

export const errorMiddleware: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ message: err.message });
    return;
  }

  if (err instanceof ZodError) {
    res.status(400).json({
      message: 'Validation failed',
      errors: err.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
    });
    return;
  }

  if (err instanceof Error) {
    const providerStatus = extractProviderStatus(err.message);
    if (providerStatus === 429 || providerStatus === 503) {
      logger.warn('Provider is temporarily unavailable', { status: providerStatus, message: err.message });
      res.status(providerStatus).json({
        message: `AI provider is temporarily overloaded. Please try again in a moment. ${extractProviderMessage(err.message)}`,
      });
      return;
    }

    logger.error(err.message, { stack: err.stack });
    res.status(500).json({
      message: err.message,
    });
    return;
  }

  logger.error('Unknown error', err);
  res.status(500).json({
    message: 'Unexpected server error',
  });
};
