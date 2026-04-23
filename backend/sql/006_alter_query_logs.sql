ALTER TABLE query_logs
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_query_logs_user_id ON query_logs(user_id);
