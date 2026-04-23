# Architecture Overview

## Components

- `frontend`: React client for upload/list/query.
- `backend`: Express API with layered architecture.
- `postgres + pgvector`: metadata + chunk vectors.

## Layered backend design

- `dtos`: request/response contract, validation schema, mapping.
- `controllers`: HTTP orchestration, validation.
- `services`: business workflows (ingestion/retrieval/generation).
- `repositories`: SQL and persistence details.
- `utils`: chunking, prompts, common helpers.

## Service extensibility pattern

Services are split by contract and implementation:

- `services/impl/*.interface.ts`: service interfaces (contracts).
- `services/impl/*.impl.ts`: concrete implementations.

This pattern lets the app swap provider-specific logic (Gemini/Groq/mock) without rewriting controllers.

## Data flow

### Ingestion

1. Receive file through `multer`.
2. Create document row (`processing`).
3. Parse text by MIME type.
4. Chunk text with overlap.
5. Generate embeddings.
6. Persist chunks + vectors.
7. Mark document `ready`.

### Query

1. Embed user question.
2. Similarity search top-K chunks.
3. Build grounded prompt with citations.
4. Generate answer from LLM.
5. Return answer + sources.
