CREATE TABLE incidents (
    key                  BIGINT       PRIMARY KEY,
    partition_id         SMALLINT     NOT NULL,
    process_instance_key BIGINT       NOT NULL,
    process_definition_key BIGINT     NOT NULL,
    element_instance_key BIGINT       NOT NULL,
    element_id           VARCHAR(255) NOT NULL,
    error_type           VARCHAR(100) NOT NULL,
    error_message        TEXT,
    state                VARCHAR(20)  NOT NULL DEFAULT 'ACTIVE',
    job_key              BIGINT,
    created_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    resolved_at          TIMESTAMPTZ,
    tenant_id            VARCHAR(255) NOT NULL DEFAULT '<default>'
);
CREATE INDEX idx_inc_pi ON incidents(process_instance_key);
CREATE INDEX idx_inc_state ON incidents(state);
