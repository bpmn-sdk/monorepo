CREATE TABLE IF NOT EXISTS variables (
    key                   INTEGER  PRIMARY KEY,
    process_instance_key  INTEGER  NOT NULL,
    element_instance_key  INTEGER,
    name                  TEXT     NOT NULL,
    value                 TEXT     NOT NULL DEFAULT 'null',
    tenant_id             TEXT     NOT NULL DEFAULT '<default>',
    UNIQUE (process_instance_key, name)
);
CREATE INDEX IF NOT EXISTS idx_vars_pi ON variables (process_instance_key);
