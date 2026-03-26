CREATE TABLE partition_key_state (
    partition_id  SMALLINT PRIMARY KEY,
    next_key      BIGINT   NOT NULL DEFAULT 1
);
INSERT INTO partition_key_state (partition_id, next_key) VALUES (1, 1);
