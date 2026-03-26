/// Default partition ID used for single-partition deployments.
pub const DEFAULT_PARTITION: u32 = 1;

/// Number of bits used for the local key portion.
/// Partition ID is stored in bits 51-63 (13 bits), local key in bits 0-50 (51 bits).
const KEY_BITS: u32 = 51;
const PARTITION_KEY_MASK: i64 = (1i64 << KEY_BITS) - 1;

/// Encode a partition-scoped key into a global i64 key.
///
/// Zeebe key format: `(partition_id << 51) | local_key`
///
/// # Example
/// ```
/// use reebe_protocol::key::{encode_key, decode_partition_id, decode_local_key};
/// let key = encode_key(1, 42);
/// assert_eq!(decode_partition_id(key), 1);
/// assert_eq!(decode_local_key(key), 42);
/// ```
pub fn encode_key(partition_id: u32, local_key: u64) -> i64 {
    ((partition_id as i64) << KEY_BITS) | (local_key as i64 & PARTITION_KEY_MASK)
}

/// Extract the partition ID from a global key.
pub fn decode_partition_id(key: i64) -> u32 {
    ((key >> KEY_BITS) as u32) & 0x1FFF
}

/// Extract the local key from a global key.
pub fn decode_local_key(key: i64) -> u64 {
    (key & PARTITION_KEY_MASK) as u64
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_encode_decode_roundtrip() {
        let partition_id = 1u32;
        let local_key = 12345u64;
        let encoded = encode_key(partition_id, local_key);
        assert_eq!(decode_partition_id(encoded), partition_id);
        assert_eq!(decode_local_key(encoded), local_key);
    }

    #[test]
    fn test_encode_decode_partition_2() {
        let partition_id = 2u32;
        let local_key = 999u64;
        let encoded = encode_key(partition_id, local_key);
        assert_eq!(decode_partition_id(encoded), partition_id);
        assert_eq!(decode_local_key(encoded), local_key);
    }

    #[test]
    fn test_default_partition() {
        assert_eq!(DEFAULT_PARTITION, 1);
    }

    #[test]
    fn test_large_local_key() {
        let partition_id = 1u32;
        let local_key = (1u64 << 50) - 1; // max 50-bit value
        let encoded = encode_key(partition_id, local_key);
        assert_eq!(decode_partition_id(encoded), partition_id);
        assert_eq!(decode_local_key(encoded), local_key);
    }

    #[test]
    fn test_multiple_partitions() {
        for pid in 1..=8u32 {
            for lk in [1u64, 100, 1000, 100_000] {
                let encoded = encode_key(pid, lk);
                assert_eq!(decode_partition_id(encoded), pid, "partition_id mismatch for pid={pid}, lk={lk}");
                assert_eq!(decode_local_key(encoded), lk, "local_key mismatch for pid={pid}, lk={lk}");
            }
        }
    }
}
