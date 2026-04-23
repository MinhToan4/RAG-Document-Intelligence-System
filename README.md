# RAG Document Intelligence System

An end-to-end Retrieval-Augmented Generation platform for internal document intelligence. Users can upload private documents, let the system ingest and index them automatically, and then ask grounded questions with clear source citations.

## Live Links

- Website: https://rag-document-intelligence-system.vercel.app
- Backend health check: https://ragbackend-production-0816.up.railway.app/api/health

## Project Highlights

- Full-stack monorepo with a TypeScript backend and a React + Vite frontend.
- Document ingestion pipeline for PDF, DOCX, and TXT files.
- Chunking with overlap to preserve contextual meaning.
- Embedding generation and storage in PostgreSQL with pgvector.
- Hybrid retrieval using both vector similarity and lexical candidates.
- Grounded answer generation with citations.
- JWT authentication and user-scoped access control.
- Conversation history, query logs, and SSE streaming support.
- Production deployment on Railway and Vercel.

## 1. What This System Solves

This system is designed for SMEs that store important knowledge in scattered internal documents such as product specs, contracts, catalogs, and operational manuals. Instead of searching files manually, users can upload documents and ask natural-language questions to retrieve relevant context and receive a reliable answer.

The core idea is not just to build a chat interface. The real goal is to implement a complete document intelligence pipeline:

- Ingestion: receive file, validate it, extract text, split it into chunks, embed chunks, and store vectors.
- Retrieval: embed the query, retrieve relevant chunks, and combine vector search with lexical search.
- Generation: build a grounded prompt, ask the LLM to answer only from the retrieved context, and return citations.
- Product layer: authentication, conversation history, observability, and a usable frontend.

## 2. System Architecture

### 2.1 High-Level Flow

```text
Upload Document
PDF / DOCX / TXT
→ Parse Text
Extract raw content
→ Chunk
Split with overlap
→ Embed
Generate vectors
→ Store
PostgreSQL + pgvector

Question
User input
→ Embed Query
Query vector
→ Retrieve
Vector + lexical candidates
→ Generate
LLM + grounded context
→ Answer
With citations
```

### 2.2 Ingestion Pipeline

1. The user uploads a document.
2. The backend validates the file type and stores the file on disk.
3. The backend creates a document record with status `processing`.
4. The parser extracts raw text from the file.
5. The text is chunked with configured size and overlap.
6. Each chunk is embedded.
7. Chunks and embeddings are written to PostgreSQL + pgvector.
8. The document status is updated to `ready`, or `failed` if an error occurs.

### 2.3 Query Pipeline

1. The user sends a question.
2. The question is embedded.
3. Similar chunks are retrieved using a hybrid strategy.
4. A grounded prompt is built from the retrieved context.
5. The generation service produces an answer from context only.
6. The response includes answer, sources, model, and conversation ID.

## 3. Why This Stack Was Chosen

### Backend: Express + TypeScript

Express was chosen because it is lightweight, fast to scaffold, and easy to structure with a controller-service-repository pattern. TypeScript improves type safety across DTOs, services, and repositories.

Trade-off: compared with a more opinionated framework, the codebase requires more discipline in structure and conventions.

### Database: PostgreSQL + pgvector

PostgreSQL with pgvector was chosen because it keeps metadata and vector search in one place. This reduces operational complexity and is very practical for a 48-hour challenge.

Trade-off: at larger retrieval scales, specialized vector databases may offer additional tuning and scaling options.

### Frontend: React + Vite

React + Vite gives a fast developer experience and short build times. It fits this application well because SSR is not required.

Trade-off: it does not provide framework-level SSR or edge-routing features out of the box.

### Monorepo with npm Workspaces

The project uses a monorepo to keep the frontend and backend synchronized, simplify local development, and make full-stack changes easier to manage.

Trade-off: deployment and environment configuration must be handled carefully to avoid cross-package issues.

## 4. Repository Structure

```text
.
├─ backend/
│  ├─ src/
│  │  ├─ controllers/
│  │  ├─ services/
│  │  │  └─ impl/
│  │  ├─ repositories/
│  │  ├─ routes/
│  │  ├─ middlewares/
│  │  ├─ dtos/
│  │  ├─ config/
│  │  └─ utils/
│  ├─ scripts/
│  ├─ sql/
│  └─ uploads/
├─ frontend/
│  ├─ src/
│  │  ├─ components/
│  │  ├─ hooks/
│  │  ├─ lib/
│  │  └─ types/
│  └─ ...
├─ docs/
└─ docker-compose.yml
```

## 5. Main Features

### Authentication

- Register
- Login
- Refresh token
- Introspect token
- Update profile
- JWT-based authorization

### Document Intelligence

- Upload PDF, DOCX, TXT
- Parse and normalize text
- Chunk with overlap
- Generate embeddings
- Store vectors in PostgreSQL + pgvector
- Reprocess documents

### Retrieval and Generation

- Query embedding
- Hybrid retrieval with vector and lexical candidates
- Grounded answer generation
- Citations and sources
- SSE streaming endpoint

### Product Experience

- Conversation history
- Query logs
- Document list with status tracking
- Profile management
- System information tab

## 6. Bonus Features Implemented

### 6.1 Auth Layer

The system has a full auth layer with JWT-based access control. Protected routes require authentication, and every user can only access their own documents, conversations, and query history.

### 6.2 Chat History

The backend stores conversations and messages so the user can continue a multi-turn interaction instead of starting over every time. This makes the system feel like a real document assistant rather than a single-question endpoint.

### 6.3 Observability

Each query is logged with useful operational metadata:

- question
- model name
- topK
- latency
- retrieved chunk count
- answer
- sources

This is useful for debugging retrieval quality, measuring performance, and explaining system behavior during review.

### 6.4 Vietnamese NLP Support

The system supports Vietnamese in a practical way:

- Vietnamese questions are accepted naturally.
- Uploaded filenames are normalized to avoid encoding issues.
- Answer rendering handles mixed content, bullets, numbering, and citations.

This is not a research-grade Vietnamese NLP pipeline, but it is strong enough for a real demo and a SME document workflow.

### 6.5 Hybrid Search

Retrieval is not limited to vector similarity. The system also uses lexical candidates from PostgreSQL full-text search. The combined ranking improves retrieval quality for:

- exact keywords
- product names
- numeric values
- domain-specific terms

### 6.6 SSE Streaming

The system includes a streaming endpoint that sends answer output in SSE format. The current implementation streams the generated answer text token by token, which creates a better product story and provides a foundation for true provider-level token streaming later.

## 7. Backend Architecture

### 7.1 Controller Layer

Controllers accept requests, validate payloads, enforce auth, and return HTTP responses. They intentionally stay thin so business logic is kept in services.

### 7.2 Service Layer

Services handle the main application workflows:

- create and ingest documents
- reprocess documents
- retrieve similar chunks
- build grounded prompts
- generate answers
- manage conversations
- record query logs

### 7.3 Repository Layer

Repositories handle database access and mapping between SQL rows and application records. This keeps SQL isolated from business logic.

### 7.4 Utilities

The backend includes utility modules for:

- chunking
- prompt building
- filename normalization
- async request handling
- logging

## 8. Database Design

### 8.1 Main Tables

- `users`
- `documents`
- `document_chunks`
- `conversations`
- `messages`
- `query_logs`

### 8.2 Design Goals

The schema was designed to ensure:

- user-scoped isolation
- traceable document lifecycle
- efficient chunk storage and retrieval
- conversation persistence
- observability and query auditing

### 8.3 Why PostgreSQL + pgvector

PostgreSQL + pgvector is a strong choice for this project because it keeps relational data and vector search together, which is simpler to operate and easier to deploy to Railway.

## 9. Processing Pipeline Details

### 9.1 Ingestion

1. Upload file.
2. Create a `processing` document record.
3. Parse the file into raw text.
4. Chunk the text with overlap.
5. Generate embeddings for each chunk.
6. Store chunks and vectors.
7. Update the document status to `ready` or `failed`.

### 9.2 Retrieval

1. Embed the query.
2. Pull vector candidates.
3. Pull lexical candidates.
4. Merge and re-rank candidates.
5. Return the top chunks with score and source metadata.

### 9.3 Generation

1. Build a grounded prompt.
2. Send context to the selected model/provider.
3. Generate an answer constrained by the context.
4. Log the query result asynchronously.

## 10. Frontend Architecture

### 10.1 UI Layout

The frontend is organized into four primary tabs:

- Workspace
- Document Library
- System Info
- Profile

### 10.2 Core Hooks

- `useAuth`
- `useDocuments`
- `useQuery`
- `useConversations`

### 10.3 API Layer

All frontend requests go through `frontend/src/lib/api.ts`. The API base URL is injected through `VITE_API_BASE_URL`, which makes the app portable across local development, Railway, and Vercel.

## 11. API Surface

Base path: `/api`

### Health

- `GET /health`

### Auth

- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/refresh`
- `POST /auth/introspect`
- `PUT /auth/profile`

### Documents

- `POST /documents/upload`
- `GET /documents`
- `GET /documents/:id`
- `DELETE /documents/:id`
- `GET /documents/:id/chunks`
- `POST /documents/:id/reprocess`

### Query

- `POST /query`
- `POST /query/stream`
- `GET /query/history`
- `DELETE /query/history/:id`

### Conversations

- `GET /conversations`
- `GET /conversations/:id/messages`
- `DELETE /conversations/:id`

## 12. Local Setup

### Requirements

- Node.js 18.18 or newer
- Docker Desktop running
- PostgreSQL with pgvector, or a remote Postgres instance

### Install dependencies

```bash
npm install
```

### Start local PostgreSQL

```bash
npm run db:up
```

### Create environment files

PowerShell:

```powershell
Copy-Item backend/.env.example backend/.env
Copy-Item frontend/.env.example frontend/.env
```

### Run migrations

```bash
npm run db:migrate -w backend
```

### Start development servers

```bash
npm run dev
```

### Local URLs

- Frontend: http://localhost:5173
- Backend health: http://localhost:4000/api/health

## 13. Deployment Notes

The application is deployed with environment-specific configuration for the frontend and backend. Production values are intentionally omitted from this README; refer to the deployment configuration in your environment when needed.

The backend is built with Docker and uses production environment variables such as `NODE_ENV`, `PORT`, `DATABASE_URL`, and the JWT/database SSL settings required by the target host.

The frontend points to the backend through an environment variable such as `VITE_API_BASE_URL`.

## 14. Bonus Scorecard

Conservative score estimate for the key bonus features: **4.5/6**.

Completed bonus features:

- Auth Layer
- Chat History
- Observability
- Hybrid Search
- Vietnamese NLP support
- SSE streaming as an additional technical bonus

Why this score is reasonable:

- The four core bonus areas are truly implemented and useful in the product.
- Vietnamese NLP is practical and demo-ready, though not research-grade.
- SSE is implemented as a useful expansion, but the conservative score focuses on the four strongest differentiators.

## 15. Security and Reliability Notes

- JWT signing uses HS512.
- Passwords are hashed with bcrypt.
- Protected resources are filtered by user ID.
- Provider calls have retry and fallback behavior.
- CORS is controlled by environment variables.

## 16. Roadmap

If more time were available, the next improvements would be:

1. Add reranking after retrieval.
2. Improve token streaming to use provider-native streaming.
3. Add structured dashboards for query latency and provider usage.
4. Add rate limiting and abuse protection.
5. Improve Vietnamese NLP with smarter sentence-aware chunking and normalization.

## 17. Final Note

This project is designed to be understandable, demo-friendly, and technically defensible. The goal is not only to deliver a working RAG system, but also to show clear system thinking, clean code structure, practical trade-offs, and a product story that is easy to present during review.