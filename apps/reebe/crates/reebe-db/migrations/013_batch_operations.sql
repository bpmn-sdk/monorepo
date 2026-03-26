CREATE TABLE IF NOT EXISTS batch_operations (
    key BIGINT PRIMARY KEY,
    operation_type TEXT NOT NULL,
    state TEXT NOT NULL DEFAULT 'ACTIVE',
    items_count BIGINT NOT NULL DEFAULT 0,
    completed_items BIGINT NOT NULL DEFAULT 0,
    failed_items BIGINT NOT NULL DEFAULT 0,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_batch_operations_state ON batch_operations(state);
CREATE INDEX IF NOT EXISTS idx_batch_operations_type ON batch_operations(operation_type);
