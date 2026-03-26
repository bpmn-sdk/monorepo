CREATE TABLE signal_subscriptions (
    key                  BIGINT       PRIMARY KEY,
    signal_name          VARCHAR(255) NOT NULL,
    process_instance_key BIGINT       NOT NULL,
    element_instance_key BIGINT       NOT NULL,
    element_id           VARCHAR(255) NOT NULL,
    bpmn_process_id      VARCHAR(255) NOT NULL DEFAULT '',
    process_definition_key BIGINT     NOT NULL DEFAULT 0,
    flow_scope_key       BIGINT       NOT NULL,
    tenant_id            VARCHAR(255) NOT NULL DEFAULT '<default>'
);
CREATE INDEX idx_sigsubscriptions_name ON signal_subscriptions(signal_name, tenant_id);
CREATE INDEX idx_sigsubscriptions_pi ON signal_subscriptions(process_instance_key);
