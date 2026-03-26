ALTER TABLE jobs ADD COLUMN retry_back_off_at TIMESTAMPTZ;
CREATE INDEX idx_jobs_backoff ON jobs(retry_back_off_at)
    WHERE retry_back_off_at IS NOT NULL AND state = 'ACTIVATABLE';
