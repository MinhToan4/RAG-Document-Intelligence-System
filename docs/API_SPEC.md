# API Specification

Base URL: `http://localhost:4000`

## Health

### `GET /api/health`

Response:

```json
{
  "status": "ok",
  "timestamp": "2026-04-23T10:00:00.000Z"
}
```

## Documents

### `POST /api/documents/upload`

Multipart form-data:

- `file` (required): pdf/docx/txt
- `name` (optional): display name

Response `201`:

```json
{
  "id": "uuid",
  "name": "Q3 Report.pdf",
  "status": "processing",
  "createdAt": "2026-04-23T10:00:00.000Z"
}
```

### `GET /api/documents?page=1&limit=20&status=ready`

Response `200`:

```json
{
  "data": [],
  "total": 0,
  "page": 1,
  "limit": 20
}
```

### `GET /api/documents/:id`

### `DELETE /api/documents/:id`

Response `204` (no body)

### `GET /api/documents/:id/chunks`

### `POST /api/documents/:id/reprocess`

## Query

### `POST /api/query`

Request:

```json
{
  "question": "Doanh thu Q3 là bao nhiêu?",
  "documentIds": ["uuid"],
  "topK": 5
}
```

Response:

```json
{
  "answer": "Doanh thu Q3...",
  "sources": [
    {
      "documentId": "uuid",
      "documentName": "Q3 Report.pdf",
      "chunkIndex": 4,
      "snippet": "....",
      "score": 0.91
    }
  ],
  "model": "gemini-2.5-flash"
}
```

### `POST /api/query/stream`

Request body same as `/api/query`.

SSE response:

```text
data: {"token":"Doanh"}

data: {"token":" thu"}

data: {"done":true,"sources":[...],"model":"gemini-2.5-flash"}
```
