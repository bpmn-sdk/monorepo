-- Convert partition_records to a PostgreSQL native partitioned table.
-- This migration is idempotent: if the table is already partitioned it is a no-op.
-- Requires PostgreSQL 10+.
--
-- Steps:
--   1. Rename existing table.
--   2. Create new LIST-partitioned table with the same columns + constraints.
--   3. Create child partitions for partition IDs 0-15 (supports up to 16 partitions).
--   4. Copy existing data into the new table.
--   5. Drop the old table.
--   6. Recreate indexes on the new table.

DO $$
BEGIN
  -- Only run if not already partitioned
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_partitioned_table pt ON pt.partrelid = c.oid
    WHERE c.relname = 'partition_records'
  ) THEN

    -- Step 1: rename old table
    ALTER TABLE partition_records RENAME TO partition_records_old;

    -- Step 2: create new partitioned table
    CREATE TABLE partition_records (
        partition_id  SMALLINT     NOT NULL,
        position      BIGINT       NOT NULL,
        record_type   TEXT         NOT NULL,
        value_type    TEXT         NOT NULL,
        intent        TEXT         NOT NULL,
        record_key    BIGINT       NOT NULL,
        timestamp_ms  BIGINT       NOT NULL,
        payload       JSONB        NOT NULL DEFAULT '{}',
        source_position BIGINT,
        tenant_id     TEXT         NOT NULL DEFAULT '<default>',
        PRIMARY KEY (partition_id, position)
    ) PARTITION BY LIST (partition_id);

    -- Step 3: child partitions for IDs 0–15
    CREATE TABLE partition_records_p0  PARTITION OF partition_records FOR VALUES IN (0);
    CREATE TABLE partition_records_p1  PARTITION OF partition_records FOR VALUES IN (1);
    CREATE TABLE partition_records_p2  PARTITION OF partition_records FOR VALUES IN (2);
    CREATE TABLE partition_records_p3  PARTITION OF partition_records FOR VALUES IN (3);
    CREATE TABLE partition_records_p4  PARTITION OF partition_records FOR VALUES IN (4);
    CREATE TABLE partition_records_p5  PARTITION OF partition_records FOR VALUES IN (5);
    CREATE TABLE partition_records_p6  PARTITION OF partition_records FOR VALUES IN (6);
    CREATE TABLE partition_records_p7  PARTITION OF partition_records FOR VALUES IN (7);
    CREATE TABLE partition_records_p8  PARTITION OF partition_records FOR VALUES IN (8);
    CREATE TABLE partition_records_p9  PARTITION OF partition_records FOR VALUES IN (9);
    CREATE TABLE partition_records_p10 PARTITION OF partition_records FOR VALUES IN (10);
    CREATE TABLE partition_records_p11 PARTITION OF partition_records FOR VALUES IN (11);
    CREATE TABLE partition_records_p12 PARTITION OF partition_records FOR VALUES IN (12);
    CREATE TABLE partition_records_p13 PARTITION OF partition_records FOR VALUES IN (13);
    CREATE TABLE partition_records_p14 PARTITION OF partition_records FOR VALUES IN (14);
    CREATE TABLE partition_records_p15 PARTITION OF partition_records FOR VALUES IN (15);

    -- Step 4: copy existing data
    INSERT INTO partition_records SELECT * FROM partition_records_old;

    -- Step 5: drop old table
    DROP TABLE partition_records_old;

    -- Step 6: recreate indexes
    CREATE INDEX IF NOT EXISTS idx_partition_records_type
        ON partition_records (partition_id, record_type, position);
    CREATE INDEX IF NOT EXISTS idx_partition_records_value_type
        ON partition_records (partition_id, value_type, intent, position);

  END IF;
END
$$;
