//! Startup replay: rebuilds state projections from the partition_records event log.
//!
//! This is used when:
//! - The state projections are detected as empty on startup
//! - An operator explicitly requests a rebuild
//!
//! The replay reads all EVENT records from partition_records in order and re-applies
//! the projection updates. It does NOT re-process COMMAND records (that would cause
//! side effects like re-sending responses).

#[cfg(any(feature = "postgres", feature = "sqlite"))]
use reebe_db::DbPool;
#[cfg(any(feature = "postgres", feature = "sqlite"))]
use tracing::{info, warn};

/// Check if projections appear to need replay (e.g., process_instances table is empty
/// but partition_records has events).
#[cfg(any(feature = "postgres", feature = "sqlite"))]
pub async fn needs_replay(pool: &DbPool, partition_id: i16) -> bool {
    // Check if there are any EVENT records but no process instances
    let event_count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM partition_records WHERE partition_id = $1 AND record_type = 'EVENT'"
    )
    .bind(partition_id)
    .fetch_one(pool)
    .await
    .unwrap_or(0);

    if event_count == 0 {
        return false;
    }

    let instance_count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM process_instances"
    )
    .fetch_one(pool)
    .await
    .unwrap_or(0);

    // If we have events but no instances, projections might be stale
    event_count > 0 && instance_count == 0
}

/// Run a startup check and log whether replay might be needed.
///
/// Full replay is complex and potentially destructive. For now, this function
/// detects the condition and logs a warning. A full replay implementation would
/// re-apply all projection updates from the event log.
#[cfg(any(feature = "postgres", feature = "sqlite"))]
pub async fn check_and_log_replay_status(pool: &DbPool, partition_id: i16) {
    if needs_replay(pool, partition_id).await {
        warn!(
            partition_id,
            "State projections appear to be empty while event log is non-empty. \
             Consider running a full projection rebuild. \
             This can happen after a database restore or schema reset."
        );
    } else {
        info!(partition_id, "Projection state looks consistent with event log");
    }
}
