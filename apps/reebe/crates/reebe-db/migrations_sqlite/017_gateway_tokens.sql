CREATE TABLE IF NOT EXISTS gateway_tokens (
    process_instance_key INTEGER  NOT NULL,
    element_id           TEXT     NOT NULL,
    token_count          INTEGER  NOT NULL DEFAULT 0,
    PRIMARY KEY (process_instance_key, element_id)
);
