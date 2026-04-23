import { config } from 'dotenv';
import { z } from 'zod';

config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  DB_SSL_ENABLED: z.enum(['true', 'false']).optional(),
  DB_SSL_REJECT_UNAUTHORIZED: z.enum(['true', 'false']).optional(),
  AI_PROVIDER: z.enum(['gemini', 'groq']).default('gemini'),
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_API_KEY_SECONDARY: z.string().optional(),
  GROQ_API_KEY: z.string().optional(),
  EMBEDDING_MODEL: z.string().min(1).default('gemini-embedding-001'),
  LLM_MODEL: z.string().min(1).default('gemini-2.5-flash'),
  LLM_FALLBACK_MODELS: z.string().optional(),
  LLM_FALLBACK_PROVIDERS: z.string().optional(),
  GROQ_MODEL: z.string().min(1).default('llama-3.3-70b-versatile'),
  GROQ_FALLBACK_MODELS: z.string().optional(),
  JWT_SIGN_KEY: z.string().min(32, 'JWT_SIGN_KEY must be at least 32 chars'),
  JWT_ISSUER: z.string().min(1).default('RAGDocumentIntelligenceSystem'),
  JWT_ACCESS_TOKEN_DURATION: z.coerce.number().int().positive().default(3600),
  JWT_REFRESH_TOKEN_DURATION: z.coerce.number().int().positive().default(604800),
  EMBEDDING_DIM: z.coerce.number().int().positive().default(768),
  CHUNK_SIZE: z.coerce.number().int().positive().default(500),
  CHUNK_OVERLAP: z.coerce.number().int().nonnegative().default(50),
  TOP_K_DEFAULT: z.coerce.number().int().positive().default(5),
  MAX_FILE_SIZE_MB: z.coerce.number().int().positive().default(20),
  FRONTEND_ORIGIN: z.string().default('http://localhost:5173'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const details = parsed.error.issues
    .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
    .join('\n');
  throw new Error(`Invalid environment variables:\n${details}`);
}

export const env = parsed.data;
