use crate::record_type::RecordType;
use crate::value_type::ValueType;
use serde::{Deserialize, Serialize};

/// A Record represents a single entry in the Reebe event log.
///
/// Records are the fundamental unit of state change. Every command, event, and
/// rejection is represented as a Record. The payload field contains the domain-specific
/// value serialized as JSON.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Record {
    /// The partition this record belongs to.
    pub partition_id: i32,
    /// Monotonically increasing position within the partition log.
    pub position: i64,
    /// Globally unique 64-bit key (51-bit local key | 13-bit partition ID).
    pub key: i64,
    /// Unix timestamp in milliseconds when this record was created.
    pub timestamp: i64,
    /// Whether this is a Command, Event, or Rejection.
    pub record_type: RecordType,
    /// The domain this record belongs to.
    pub value_type: ValueType,
    /// The specific intent within the domain (e.g., "ELEMENT_ACTIVATING", "COMPLETED").
    pub intent: String,
    /// The domain-specific payload as JSON.
    pub payload: serde_json::Value,
    /// Position of the source command that triggered this record (for events/rejections).
    pub source_position: Option<i64>,
    /// Tenant identifier for multi-tenancy support.
    pub tenant_id: String,
    /// Version of the broker that produced this record.
    pub broker_version: String,
}

impl Record {
    /// Create a new record with auto-assigned defaults for position, timestamp, etc.
    pub fn new(
        partition_id: i32,
        key: i64,
        record_type: RecordType,
        value_type: ValueType,
        intent: String,
        payload: serde_json::Value,
    ) -> Self {
        let timestamp = chrono::Utc::now().timestamp_millis();
        Self {
            partition_id,
            position: 0, // assigned by the log sequencer
            key,
            timestamp,
            record_type,
            value_type,
            intent,
            payload,
            source_position: None,
            tenant_id: "<default>".to_string(),
            broker_version: "1.0.0".to_string(),
        }
    }

    /// Create a new command record.
    pub fn command(
        partition_id: i32,
        key: i64,
        value_type: ValueType,
        intent: String,
        payload: serde_json::Value,
    ) -> Self {
        Self::new(
            partition_id,
            key,
            RecordType::Command,
            value_type,
            intent,
            payload,
        )
    }

    /// Create a new event record.
    pub fn event(
        partition_id: i32,
        key: i64,
        value_type: ValueType,
        intent: String,
        payload: serde_json::Value,
        source_position: Option<i64>,
    ) -> Self {
        let mut record = Self::new(
            partition_id,
            key,
            RecordType::Event,
            value_type,
            intent,
            payload,
        );
        record.source_position = source_position;
        record
    }

    /// Create a rejection record.
    pub fn rejection(
        partition_id: i32,
        key: i64,
        value_type: ValueType,
        intent: String,
        payload: serde_json::Value,
        source_position: Option<i64>,
    ) -> Self {
        let mut record = Self::new(
            partition_id,
            key,
            RecordType::Rejection,
            value_type,
            intent,
            payload,
        );
        record.source_position = source_position;
        record
    }

    /// Set the tenant ID.
    pub fn with_tenant(mut self, tenant_id: impl Into<String>) -> Self {
        self.tenant_id = tenant_id.into();
        self
    }

    /// Set the source position.
    pub fn with_source_position(mut self, source_position: i64) -> Self {
        self.source_position = Some(source_position);
        self
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_record_creation() {
        let record = Record::new(
            1,
            100,
            RecordType::Command,
            ValueType::ProcessInstance,
            "CREATE".to_string(),
            serde_json::json!({"test": "value"}),
        );
        assert_eq!(record.partition_id, 1);
        assert_eq!(record.key, 100);
        assert_eq!(record.record_type, RecordType::Command);
        assert_eq!(record.value_type, ValueType::ProcessInstance);
        assert_eq!(record.intent, "CREATE");
        assert_eq!(record.tenant_id, "<default>");
    }

    #[test]
    fn test_serde_roundtrip() {
        let record = Record::new(
            1,
            42,
            RecordType::Event,
            ValueType::Job,
            "CREATED".to_string(),
            serde_json::json!({"jobType": "my-job"}),
        );
        let json = serde_json::to_string(&record).unwrap();
        let restored: Record = serde_json::from_str(&json).unwrap();
        assert_eq!(restored.key, record.key);
        assert_eq!(restored.intent, record.intent);
        assert_eq!(restored.value_type, record.value_type);
    }

    #[test]
    fn test_command_constructor() {
        let record = Record::command(
            1,
            200,
            ValueType::Deployment,
            "CREATE".to_string(),
            serde_json::json!({}),
        );
        assert_eq!(record.record_type, RecordType::Command);
    }

    #[test]
    fn test_event_constructor() {
        let record = Record::event(
            1,
            200,
            ValueType::Deployment,
            "CREATED".to_string(),
            serde_json::json!({}),
            Some(10),
        );
        assert_eq!(record.record_type, RecordType::Event);
        assert_eq!(record.source_position, Some(10));
    }
}
