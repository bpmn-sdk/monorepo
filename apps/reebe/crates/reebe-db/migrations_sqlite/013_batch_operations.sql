CREATE TABLE IF NOT EXISTS batch_operations (
    key              INTEGER  PRIMARY KEY,
    operation_type   TEXT     NOT NULL,
    state            TEXT     NOT NULL DEFAULT 'ACTIVE',
    items_count      INTEGER  NOT NULL DEFAULT 0,
    completed_items  INTEGER  NOT NULL DEFAULT 0,
    failed_items     INTEGER  NOT NULL DEFAULT 0,
    error_message    TEXT,
    created_at       TEXT     NOT NULL DEFAULT (datetime('now')),
    completed_at     TEXT
);
