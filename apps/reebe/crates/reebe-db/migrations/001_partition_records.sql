CREATE TABLE partition_records (
    partition_id     SMALLINT     NOT NULL,
    position         BIGINT       NOT NULL,
    record_type      VARCHAR(20)  NOT NULL,
    value_type       VARCHAR(50)  NOT NULL,
    intent           VARCHAR(80)  NOT NULL,
    record_key       BIGINT       NOT NULL,
    timestamp_ms     BIGINT       NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000,
    payload          JSONB        NOT NULL DEFAULT '{}',
    source_position  BIGINT,
    tenant_id        VARCHAR(255) NOT NULL DEFAULT '<default>',
    PRIMARY KEY (partition_id, position)
);
CREATE INDEX idx_records_key ON partition_records(record_key);
CREATE INDEX idx_records_vt_intent ON partition_records(value_type, intent);
CREATE INDEX idx_records_position ON partition_records(position);
