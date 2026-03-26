CREATE TABLE IF NOT EXISTS timers (
    key                   INTEGER  PRIMARY KEY,
    process_instance_key  INTEGER  NOT NULL,
    element_instance_key  INTEGER  NOT NULL,
    element_id            TEXT     NOT NULL,
    due_date              TEXT     NOT NULL,
    state                 TEXT     NOT NULL DEFAULT 'ACTIVE',
    tenant_id             TEXT     NOT NULL DEFAULT '<default>'
);
CREATE INDEX IF NOT EXISTS idx_timers_due ON timers (due_date, state);
