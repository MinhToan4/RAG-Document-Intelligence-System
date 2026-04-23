-- Add answer and sources to query_logs for chat replay
ALTER TABLE query_logs ADD COLUMN IF NOT EXISTS answer TEXT;
ALTER TABLE query_logs ADD COLUMN IF NOT EXISTS sources JSONB;
