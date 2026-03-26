CREATE TABLE process_instances (
    key                          BIGINT       PRIMARY KEY,
    partition_id                 SMALLINT     NOT NULL,
    process_definition_key       BIGINT       NOT NULL,
    bpmn_process_id              VARCHAR(255) NOT NULL,
    version                      INTEGER      NOT NULL,
    state                        VARCHAR(30)  NOT NULL DEFAULT 'ACTIVE',
    start_date                   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    end_date                     TIMESTAMPTZ,
    parent_process_instance_key  BIGINT,
    parent_element_instance_key  BIGINT,
    root_process_instance_key    BIGINT       NOT NULL,
    tenant_id                    VARCHAR(255) NOT NULL DEFAULT '<default>'
);
CREATE INDEX idx_pi_state ON process_instances(state);
CREATE INDEX idx_pi_bpmn_id ON process_instances(bpmn_process_id);
CREATE INDEX idx_pi_proc_def ON process_instances(process_definition_key);

CREATE TABLE element_instances (
    key                    BIGINT       PRIMARY KEY,
    partition_id           SMALLINT     NOT NULL,
    process_instance_key   BIGINT       NOT NULL REFERENCES process_instances(key) ON DELETE CASCADE,
    process_definition_key BIGINT       NOT NULL,
    bpmn_process_id        VARCHAR(255) NOT NULL,
    element_id             VARCHAR(255) NOT NULL,
    element_type           VARCHAR(50)  NOT NULL,
    state                  VARCHAR(30)  NOT NULL DEFAULT 'ACTIVATING',
    flow_scope_key         BIGINT,
    scope_key              BIGINT,
    incident_key           BIGINT,
    tenant_id              VARCHAR(255) NOT NULL DEFAULT '<default>'
);
CREATE INDEX idx_ei_pi ON element_instances(process_instance_key);
CREATE INDEX idx_ei_state ON element_instances(state);
CREATE INDEX idx_ei_element ON element_instances(element_id);
