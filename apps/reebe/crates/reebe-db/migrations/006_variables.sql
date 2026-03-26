CREATE TABLE variables (
    key                  BIGINT       PRIMARY KEY,
    partition_id         SMALLINT     NOT NULL,
    name                 VARCHAR(255) NOT NULL,
    value                JSONB        NOT NULL DEFAULT 'null',
    scope_key            BIGINT       NOT NULL,
    process_instance_key BIGINT       NOT NULL,
    tenant_id            VARCHAR(255) NOT NULL DEFAULT '<default>',
    is_preview           BOOLEAN      NOT NULL DEFAULT FALSE,
    UNIQUE (scope_key, name)
);
CREATE INDEX idx_var_scope ON variables(scope_key);
CREATE INDEX idx_var_pi ON variables(process_instance_key);
