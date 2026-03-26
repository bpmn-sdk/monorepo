-- Add an atomic position counter to replace the non-atomic MAX()+1 approach.
-- Seeded from the current max position so existing data is preserved.
ALTER TABLE partition_key_state
    ADD COLUMN IF NOT EXISTS next_position BIGINT NOT NULL DEFAULT 1;

UPDATE partition_key_state pk
SET next_position = COALESCE(
    (SELECT MAX(position) + 1 FROM partition_records WHERE partition_id = pk.partition_id),
    1
);
