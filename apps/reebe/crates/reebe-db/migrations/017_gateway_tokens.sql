CREATE TABLE gateway_tokens (
    process_instance_key BIGINT       NOT NULL,
    element_id           VARCHAR(255) NOT NULL,
    token_count          INT          NOT NULL DEFAULT 0,
    PRIMARY KEY (process_instance_key, element_id)
);
