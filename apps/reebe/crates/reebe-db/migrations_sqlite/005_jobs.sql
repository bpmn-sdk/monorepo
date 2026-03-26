CREATE TABLE IF NOT EXISTS jobs (
    key                    INTEGER  PRIMARY KEY,
    partition_id           INTEGER  NOT NULL,
    job_type               TEXT     NOT NULL,
    state                  TEXT     NOT NULL DEFAULT 'ACTIVATABLE',
    process_instance_key   INTEGER  NOT NULL,
    element_instance_key   INTEGER  NOT NULL,
    process_definition_key INTEGER  NOT NULL,
    bpmn_process_id        TEXT     NOT NULL,
    element_id             TEXT     NOT NULL,
    retries                INTEGER  NOT NULL DEFAULT 3,
    worker                 TEXT,
    deadline               TEXT,
    error_code             TEXT,
    error_message          TEXT,
    custom_headers         TEXT     NOT NULL DEFAULT '{}',
    variables              TEXT     NOT NULL DEFAULT '{}',
    created_at             TEXT     NOT NULL DEFAULT (datetime('now')),
    tenant_id              TEXT     NOT NULL DEFAULT '<default>'
);
CREATE INDEX IF NOT EXISTS idx_jobs_state ON jobs (state, job_type);
CREATE INDEX IF NOT EXISTS idx_jobs_pi ON jobs (process_instance_key);
