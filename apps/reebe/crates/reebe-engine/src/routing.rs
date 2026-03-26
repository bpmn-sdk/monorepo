//! Partition routing for multi-node deployments.
//!
//! Assigns commands to partitions using a stable hash so that related work
//! (e.g. all elements of the same process instance) lands on the same partition.

/// Determine which partition a given key belongs to.
///
/// Uses a simple modulo hash. For new instance creation (key = 0), callers
/// should use a hash of the process/correlation key instead.
pub fn partition_for_key(key: i64, partition_count: u32) -> i16 {
    if partition_count <= 1 {
        return 0;
    }
    // Use absolute value to handle negative keys; % partition_count gives 0..N-1
    let bucket = (key.unsigned_abs()) % partition_count as u64;
    bucket as i16
}

/// Determine partition from a string key (e.g. bpmnProcessId or correlationKey).
pub fn partition_for_str(s: &str, partition_count: u32) -> i16 {
    if partition_count <= 1 {
        return 0;
    }
    // FNV-1a 64-bit hash
    let mut hash: u64 = 14695981039346656037;
    for byte in s.bytes() {
        hash ^= byte as u64;
        hash = hash.wrapping_mul(1099511628211);
    }
    (hash % partition_count as u64) as i16
}
