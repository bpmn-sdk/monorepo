CREATE TABLE IF NOT EXISTS partition_records (
    partition_id  INTEGER  NOT NULL,
    position      INTEGER  NOT NULL,
    record_type   TEXT     NOT NULL,
    value_type    TEXT     NOT NULL,
    intent        TEXT     NOT NULL,
    record_key    INTEGER  NOT NULL,
    timestamp_ms  INTEGER  NOT NULL,
    payload       TEXT     NOT NULL DEFAULT '{}',
    source_position INTEGER,
    tenant_id     TEXT     NOT NULL DEFAULT '<default>',
    PRIMARY KEY (partition_id, position)
);
CREATE TABLE IF NOT EXISTS partition_key_state (
    partition_id  INTEGER  NOT NULL,
    next_key      INTEGER  NOT NULL DEFAULT 1,
    next_position INTEGER  NOT NULL DEFAULT 1,
    PRIMARY KEY (partition_id)
);
INSERT OR IGNORE INTO partition_key_state (partition_id, next_key, next_position) VALUES (1, 1, 1);
CREATE INDEX IF NOT EXISTS idx_pr_type ON partition_records (partition_id, record_type, position);
CREATE INDEX IF NOT EXISTS idx_pr_value_type ON partition_records (partition_id, value_type, intent, position);
