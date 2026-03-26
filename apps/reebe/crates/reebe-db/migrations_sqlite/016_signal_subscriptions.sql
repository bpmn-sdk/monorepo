CREATE TABLE IF NOT EXISTS signal_subscriptions (
    key                    INTEGER  PRIMARY KEY,
    signal_name            TEXT     NOT NULL,
    process_instance_key   INTEGER  NOT NULL,
    element_instance_key   INTEGER  NOT NULL,
    element_id             TEXT     NOT NULL,
    bpmn_process_id        TEXT     NOT NULL DEFAULT '',
    process_definition_key INTEGER  NOT NULL DEFAULT 0,
    flow_scope_key         INTEGER  NOT NULL,
    tenant_id              TEXT     NOT NULL DEFAULT '<default>'
);
CREATE INDEX IF NOT EXISTS idx_sigsubscriptions_name ON signal_subscriptions(signal_name, tenant_id);
CREATE INDEX IF NOT EXISTS idx_sigsubscriptions_pi ON signal_subscriptions(process_instance_key);
