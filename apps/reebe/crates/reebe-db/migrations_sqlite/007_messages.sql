CREATE TABLE IF NOT EXISTS messages (
    key              INTEGER  PRIMARY KEY,
    name             TEXT     NOT NULL,
    correlation_key  TEXT     NOT NULL,
    time_to_live_ms  INTEGER,
    variables        TEXT     NOT NULL DEFAULT '{}',
    state            TEXT     NOT NULL DEFAULT 'ACTIVE',
    created_at       TEXT     NOT NULL DEFAULT (datetime('now')),
    expires_at       TEXT,
    tenant_id        TEXT     NOT NULL DEFAULT '<default>'
);
CREATE TABLE IF NOT EXISTS message_subscriptions (
    key                   INTEGER  PRIMARY KEY,
    message_name          TEXT     NOT NULL,
    correlation_key       TEXT     NOT NULL,
    process_instance_key  INTEGER  NOT NULL,
    element_instance_key  INTEGER  NOT NULL,
    element_id            TEXT     NOT NULL,
    state                 TEXT     NOT NULL DEFAULT 'OPEN',
    created_at            TEXT     NOT NULL DEFAULT (datetime('now')),
    tenant_id             TEXT     NOT NULL DEFAULT '<default>'
);
