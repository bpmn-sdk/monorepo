CREATE TABLE IF NOT EXISTS incidents (
    key                    INTEGER  PRIMARY KEY,
    partition_id           INTEGER  NOT NULL,
    process_instance_key   INTEGER  NOT NULL,
    process_definition_key INTEGER  NOT NULL,
    element_instance_key   INTEGER  NOT NULL,
    element_id             TEXT     NOT NULL,
    error_type             TEXT     NOT NULL,
    error_message          TEXT,
    state                  TEXT     NOT NULL DEFAULT 'ACTIVE',
    job_key                INTEGER,
    created_at             TEXT     NOT NULL DEFAULT (datetime('now')),
    resolved_at            TEXT,
    tenant_id              TEXT     NOT NULL DEFAULT '<default>'
);
