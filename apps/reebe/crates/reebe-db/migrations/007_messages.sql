CREATE TABLE messages (
    key             BIGINT       PRIMARY KEY,
    name            VARCHAR(255) NOT NULL,
    correlation_key VARCHAR(255) NOT NULL DEFAULT '',
    time_to_live_ms BIGINT       NOT NULL DEFAULT 0,
    expires_at      TIMESTAMPTZ  NOT NULL,
    variables       JSONB        NOT NULL DEFAULT '{}',
    state           VARCHAR(20)  NOT NULL DEFAULT 'PUBLISHED',
    tenant_id       VARCHAR(255) NOT NULL DEFAULT '<default>',
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_msg_name_key ON messages(name, correlation_key);
CREATE INDEX idx_msg_expires ON messages(expires_at) WHERE state = 'PUBLISHED';

CREATE TABLE message_subscriptions (
    key                  BIGINT       PRIMARY KEY,
    message_name         VARCHAR(255) NOT NULL,
    correlation_key      VARCHAR(255) NOT NULL DEFAULT '',
    process_instance_key BIGINT       NOT NULL,
    element_instance_key BIGINT       NOT NULL,
    state                VARCHAR(20)  NOT NULL DEFAULT 'OPENING',
    tenant_id            VARCHAR(255) NOT NULL DEFAULT '<default>'
);
CREATE INDEX idx_msub_name_key ON message_subscriptions(message_name, correlation_key);
CREATE INDEX idx_msub_pi ON message_subscriptions(process_instance_key);

CREATE TABLE message_start_event_subscriptions (
    key              BIGINT       PRIMARY KEY,
    message_name     VARCHAR(255) NOT NULL,
    bpmn_process_id  VARCHAR(255) NOT NULL,
    start_event_id   VARCHAR(255) NOT NULL,
    process_definition_key BIGINT NOT NULL,
    tenant_id        VARCHAR(255) NOT NULL DEFAULT '<default>',
    UNIQUE (message_name, bpmn_process_id, tenant_id)
);
CREATE INDEX idx_mse_name ON message_start_event_subscriptions(message_name);
