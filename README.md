# RAG Document Intelligence System

Production-oriented RAG system for private document question-answering with authentication, citations, and provider/model fallback.

## 1. What this project delivers

- Fullstack monorepo: backend API + frontend UI
- User authentication (register, login, refresh token, profile update)
- Document ingestion pipeline (upload -> parse -> chunk -> embed -> store)
- Retrieval + grounded answer generation with citations
- Conversation sessions (ChatGPT-style thread + message history)
- Local development with Dockerized PostgreSQL + pgvector
- Environment templates ready: `backend/.env.example`, `frontend/.env.example`

## 2. High-level architecture

### Ingestion flow

1. User uploads PDF, DOCX, or TXT.
2. Backend parses file content.
3. Text is chunked by configured chunk size/overlap.
4. Chunks are embedded.
5. Metadata + vectors are saved to PostgreSQL (pgvector).

### Query flow

1. User asks a question.
2. Question is embedded.
3. Similar chunks are retrieved via hybrid search (vector + PostgreSQL full-text ranking).
4. Grounded prompt is built from top chunks.
5. Generation service answers from context only.
6. Response returns answer + citations + resolved model.

## 3. Why this stack (technical decisions)

### Backend: Express + TypeScript (vs heavier frameworks)

Chosen because:
- Fast setup and low boilerplate for challenge-to-production evolution.
- Easy layering with controller/service/repository pattern.
- Strong typing and maintainability via TypeScript.

Trade-off:
- Less built-in structure than opinionated frameworks (for example NestJS), so discipline is required in project organization.

### Database: PostgreSQL + pgvector (vs dedicated vector DB)

Chosen because:
- One datastore for relational metadata and vector similarity.
- Operationally simpler for small/medium teams.
- SQL migrations and indexing are straightforward.

Trade-off:
- At very large retrieval scale, specialized vector engines can provide more advanced ANN tuning and horizontal scaling options.

### Frontend: React + Vite (vs Next.js)

Chosen because:
- Fast local DX and short build times.
- No SSR requirement for this application scope.
- Clean separation from backend API.

Trade-off:
- No built-in SSR/edge routing features from framework-first meta frameworks.

### Monorepo with npm workspaces (vs multi-repo)

Chosen because:
- Shared tooling and synchronized development.
- Simpler onboarding and local run.
- Easier end-to-end refactor across FE and BE.

Trade-off:
- CI/CD pipelines should be configured carefully to avoid unnecessary cross-package rebuilds.

## 4. Repository layout

```text
.
├─ backend/
│  ├─ src/
│  │  ├─ controllers/
│  │  ├─ services/
│  │  │  └─ impl/
│  │  ├─ repositories/
│  │  ├─ routes/
│  │  ├─ dtos/
│  │  └─ ...
│  ├─ scripts/
│  ├─ sql/
│  └─ uploads/
├─ frontend/
│  └─ src/
├─ docs/
└─ docker-compose.yml
```

## 5. Prerequisites

- Node.js >= 18.18
- Docker Desktop running
- At least one provider API key (Gemini and/or Groq)

## 6. Local run (clear step-by-step)

### Step 1: install dependencies

```bash
npm install
```

### Step 2: start PostgreSQL + pgvector

```bash
npm run db:up
```

### Step 3: create env files from .env.example

macOS/Linux:

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

PowerShell:

```powershell
Copy-Item backend/.env.example backend/.env
Copy-Item frontend/.env.example frontend/.env
```

### Step 4: fill required environment values

Minimum backend values you must set in `backend/.env`:
- DATABASE_URL
- JWT_SIGN_KEY (minimum 32 chars)
- FRONTEND_ORIGIN (for local, use `http://localhost:5173`)
- AI provider key(s): GEMINI_API_KEY and/or GROQ_API_KEY

Frontend in `frontend/.env`:
- VITE_API_BASE_URL (for local, use `http://localhost:4000`)

### Step 5: run migrations

```bash
npm run db:migrate -w backend
```

### Step 6: start backend + frontend

```bash
npm run dev
```

Open:
- Frontend: http://localhost:5173
- Backend health: http://localhost:4000/api/health

### Step 7: test account (quick login)

Use this test account to verify login quickly:

- Username: `test01`
- Password: `Matkhau1@`

## 7. Useful scripts

Root:

```bash
npm run dev
npm run build
npm run typecheck
npm run db:up
npm run db:down
npm run db:logs
```

Backend:

```bash
npm run dev -w backend
npm run build -w backend
npm run start -w backend
npm run db:migrate -w backend
```

Frontend:

```bash
npm run dev -w frontend
npm run build -w frontend
npm run preview -w frontend
```

## 8. API surface (current)

Base URL: `/api`

### Health
- GET `/health`

### Auth
- POST `/auth/register`
- POST `/auth/login`
- POST `/auth/refresh`
- POST `/auth/introspect`
- PUT `/auth/profile` (authenticated)

### Documents (authenticated)
- POST `/documents/upload`
- GET `/documents`
- GET `/documents/:id`
- DELETE `/documents/:id`
- GET `/documents/:id/chunks`
- POST `/documents/:id/reprocess`

### Query (authenticated)
- POST `/query`
- POST `/query/stream`

### Conversations (authenticated)
- GET `/conversations`
- GET `/conversations/:id/messages`
- DELETE `/conversations/:id`

Legacy analytics endpoints (still available):
- GET `/query/history`
- DELETE `/query/history/:id`

## 9. Security and reliability notes

- JWT signing algorithm: HS512.
- Password hashing: bcrypt (10 rounds).
- User-scoped document/query access via auth middleware.
- Generation fallback chain supports model/provider failover.
- Transient provider error handling includes retry (for overload statuses).

## 10. If I had more time (improvement roadmap)

1. Add comprehensive automated tests:
  - integration tests for auth/document/query flows
  - contract tests for DTO validation
2. Upgrade retrieval quality:
  - hybrid retrieval (vector + lexical)
  - reranking stage before generation
3. Improve observability:
  - structured request tracing and metrics dashboards
  - latency/error budget reporting by provider/model
4. Strengthen production hardening:
  - rate limiting and abuse protection
  - background job queue for ingestion/reprocess
5. UX improvements:
  - true token streaming in UI
  - richer citation drill-down and source preview

## 11. Deployment

Detailed deployment guide is available in:

- `docs/DEPLOY_RAILWAY_VERCEL.md`
