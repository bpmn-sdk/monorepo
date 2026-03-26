CREATE TABLE jobs (
    key                    BIGINT       PRIMARY KEY,
    partition_id           SMALLINT     NOT NULL,
    job_type               VARCHAR(255) NOT NULL,
    state                  VARCHAR(30)  NOT NULL DEFAULT 'ACTIVATABLE',
    process_instance_key   BIGINT       NOT NULL,
    element_instance_key   BIGINT       NOT NULL,
    process_definition_key BIGINT       NOT NULL,
    bpmn_process_id        VARCHAR(255) NOT NULL,
    element_id             VARCHAR(255) NOT NULL,
    retries                INTEGER      NOT NULL DEFAULT 3,
    worker                 VARCHAR(255),
    deadline               TIMESTAMPTZ,
    error_code             VARCHAR(255),
    error_message          TEXT,
    custom_headers         JSONB        NOT NULL DEFAULT '{}',
    variables              JSONB        NOT NULL DEFAULT '{}',
    created_at             TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    tenant_id              VARCHAR(255) NOT NULL DEFAULT '<default>'
);
CREATE INDEX idx_jobs_type_state ON jobs(job_type, state);
CREATE INDEX idx_jobs_pi ON jobs(process_instance_key);
CREATE INDEX idx_jobs_state ON jobs(state);
CREATE INDEX idx_jobs_deadline ON jobs(deadline) WHERE deadline IS NOT NULL;
