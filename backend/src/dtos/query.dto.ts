import { z } from 'zod';

export const askQueryRequestSchema = z.object({
  question: z.string().min(3, 'question must have at least 3 characters'),
  history: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string(),
      }),
    )
    .optional(),
  documentIds: z.array(z.string().uuid()).optional(),
  topK: z.coerce.number().int().positive().max(20).optional(),
});

export type AskQueryRequestDto = z.infer<typeof askQueryRequestSchema>;

