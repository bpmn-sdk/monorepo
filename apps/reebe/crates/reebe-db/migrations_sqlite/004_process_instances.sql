CREATE TABLE IF NOT EXISTS process_instances (
    key                          INTEGER  PRIMARY KEY,
    partition_id                 INTEGER  NOT NULL,
    process_definition_key       INTEGER  NOT NULL,
    bpmn_process_id              TEXT     NOT NULL,
    version                      INTEGER  NOT NULL,
    state                        TEXT     NOT NULL DEFAULT 'ACTIVE',
    start_date                   TEXT     NOT NULL DEFAULT (datetime('now')),
    end_date                     TEXT,
    parent_process_instance_key  INTEGER,
    parent_element_instance_key  INTEGER,
    root_process_instance_key    INTEGER  NOT NULL,
    tenant_id                    TEXT     NOT NULL DEFAULT '<default>'
);
CREATE INDEX IF NOT EXISTS idx_pi_state ON process_instances (state);
CREATE INDEX IF NOT EXISTS idx_pi_process_id ON process_instances (bpmn_process_id);
