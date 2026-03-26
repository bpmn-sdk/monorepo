CREATE TABLE user_tasks (
    key                  BIGINT       PRIMARY KEY,
    partition_id         SMALLINT     NOT NULL,
    process_instance_key BIGINT       NOT NULL,
    element_instance_key BIGINT       NOT NULL,
    process_definition_key BIGINT     NOT NULL,
    bpmn_process_id      VARCHAR(255) NOT NULL,
    element_id           VARCHAR(255) NOT NULL,
    state                VARCHAR(30)  NOT NULL DEFAULT 'CREATED',
    assignee             VARCHAR(255),
    candidate_groups     TEXT[],
    candidate_users      TEXT[],
    due_date             TIMESTAMPTZ,
    follow_up_date       TIMESTAMPTZ,
    form_key             VARCHAR(255),
    custom_headers       JSONB        NOT NULL DEFAULT '{}',
    variables            JSONB        NOT NULL DEFAULT '{}',
    created_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    completed_at         TIMESTAMPTZ,
    tenant_id            VARCHAR(255) NOT NULL DEFAULT '<default>'
);
CREATE INDEX idx_ut_state ON user_tasks(state);
CREATE INDEX idx_ut_assignee ON user_tasks(assignee);
CREATE INDEX idx_ut_pi ON user_tasks(process_instance_key);
