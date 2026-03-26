CREATE TABLE IF NOT EXISTS deployments (
    key        INTEGER  PRIMARY KEY,
    tenant_id  TEXT     NOT NULL DEFAULT '<default>',
    created_at TEXT     NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS process_definitions (
    key              INTEGER  PRIMARY KEY,
    bpmn_process_id  TEXT     NOT NULL,
    version          INTEGER  NOT NULL,
    tenant_id        TEXT     NOT NULL DEFAULT '<default>',
    deployment_key   INTEGER  NOT NULL REFERENCES deployments(key),
    resource_name    TEXT     NOT NULL,
    bpmn_xml         TEXT     NOT NULL,
    bpmn_checksum    TEXT,
    UNIQUE (bpmn_process_id, version, tenant_id)
);
CREATE INDEX IF NOT EXISTS idx_pd_process_id ON process_definitions (bpmn_process_id, tenant_id);
