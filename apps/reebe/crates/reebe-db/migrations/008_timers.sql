CREATE TABLE timers (
    key                  BIGINT       PRIMARY KEY,
    process_instance_key BIGINT,
    process_definition_key BIGINT,
    element_instance_key BIGINT,
    element_id           VARCHAR(255) NOT NULL,
    due_date             TIMESTAMPTZ  NOT NULL,
    repetitions          INTEGER      NOT NULL DEFAULT 1,
    state                VARCHAR(20)  NOT NULL DEFAULT 'ACTIVE',
    tenant_id            VARCHAR(255) NOT NULL DEFAULT '<default>'
);
CREATE INDEX idx_timer_due ON timers(due_date) WHERE state = 'ACTIVE';
CREATE INDEX idx_timer_pi ON timers(process_instance_key);
