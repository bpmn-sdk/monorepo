CREATE TABLE deployments (
    key          BIGINT      PRIMARY KEY,
    tenant_id    VARCHAR(255) NOT NULL DEFAULT '<default>',
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE process_definitions (
    key              BIGINT       PRIMARY KEY,
    bpmn_process_id  VARCHAR(255) NOT NULL,
    version          INTEGER      NOT NULL,
    tenant_id        VARCHAR(255) NOT NULL DEFAULT '<default>',
    deployment_key   BIGINT       NOT NULL REFERENCES deployments(key),
    resource_name    VARCHAR(512) NOT NULL,
    bpmn_xml         TEXT         NOT NULL,
    bpmn_checksum    BYTEA,
    UNIQUE (bpmn_process_id, version, tenant_id)
);
CREATE INDEX idx_proc_def_pid ON process_definitions(bpmn_process_id, tenant_id);

CREATE TABLE decision_definitions (
    key                       BIGINT       PRIMARY KEY,
    decision_id               VARCHAR(255) NOT NULL,
    decision_requirements_key BIGINT,
    name                      VARCHAR(255),
    version                   INTEGER      NOT NULL,
    tenant_id                 VARCHAR(255) NOT NULL DEFAULT '<default>',
    deployment_key            BIGINT       NOT NULL REFERENCES deployments(key),
    resource_name             VARCHAR(512) NOT NULL,
    dmn_xml                   TEXT         NOT NULL,
    UNIQUE (decision_id, version, tenant_id)
);

CREATE TABLE decision_requirements (
    key             BIGINT       PRIMARY KEY,
    drg_id          VARCHAR(255) NOT NULL,
    name            VARCHAR(255),
    version         INTEGER      NOT NULL,
    tenant_id       VARCHAR(255) NOT NULL DEFAULT '<default>',
    deployment_key  BIGINT       NOT NULL REFERENCES deployments(key),
    resource_name   VARCHAR(512) NOT NULL,
    dmn_xml         TEXT         NOT NULL,
    UNIQUE (drg_id, version, tenant_id)
);
