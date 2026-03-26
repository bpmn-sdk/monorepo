#[cfg(test)]
mod protocol_tests {
    use crate::record::Record;
    use crate::record_type::RecordType;
    use crate::value_type::ValueType;
    use crate::key::{encode_key, decode_partition_id, decode_local_key};

    // ---- Key round-trip tests ----

    #[test]
    fn test_key_round_trip_many_values() {
        for partition in 1u32..=10 {
            for local in [1u64, 100, 1000, 999999, u32::MAX as u64] {
                let encoded = encode_key(partition, local);
                assert_eq!(decode_partition_id(encoded), partition,
                    "partition mismatch for ({partition}, {local})");
                assert_eq!(decode_local_key(encoded), local,
                    "local key mismatch for ({partition}, {local})");
            }
        }
    }

    #[test]
    fn test_key_uniqueness_across_partitions() {
        let key_p1 = encode_key(1, 1);
        let key_p2 = encode_key(2, 1);
        assert_ne!(key_p1, key_p2, "Same local key on different partitions must differ");
    }

    #[test]
    fn test_key_uniqueness_within_partition() {
        let key_a = encode_key(1, 100);
        let key_b = encode_key(1, 200);
        assert_ne!(key_a, key_b, "Different local keys on same partition must differ");
    }

    // ---- ValueType tests ----

    #[test]
    fn test_value_type_display() {
        assert_eq!(ValueType::ProcessInstance.to_string(), "PROCESS_INSTANCE");
        assert_eq!(ValueType::Job.to_string(), "JOB");
        assert_eq!(ValueType::Deployment.to_string(), "DEPLOYMENT");
        assert_eq!(ValueType::Message.to_string(), "MESSAGE");
        assert_eq!(ValueType::Incident.to_string(), "INCIDENT");
        assert_eq!(ValueType::Variable.to_string(), "VARIABLE");
        assert_eq!(ValueType::UserTask.to_string(), "USER_TASK");
        assert_eq!(ValueType::Timer.to_string(), "TIMER");
        assert_eq!(ValueType::Signal.to_string(), "SIGNAL");
    }

    #[test]
    fn test_value_type_try_from_str_valid() {
        assert_eq!(ValueType::try_from("PROCESS_INSTANCE").unwrap(), ValueType::ProcessInstance);
        assert_eq!(ValueType::try_from("JOB").unwrap(), ValueType::Job);
        assert_eq!(ValueType::try_from("DEPLOYMENT").unwrap(), ValueType::Deployment);
        assert_eq!(ValueType::try_from("MESSAGE").unwrap(), ValueType::Message);
        assert_eq!(ValueType::try_from("INCIDENT").unwrap(), ValueType::Incident);
        assert_eq!(ValueType::try_from("VARIABLE").unwrap(), ValueType::Variable);
    }

    #[test]
    fn test_value_type_try_from_str_invalid() {
        let result = ValueType::try_from("UNKNOWN_TYPE");
        assert!(result.is_err(), "Unknown type string should return an error");
    }

    #[test]
    fn test_value_type_serde_roundtrip() {
        let vt = ValueType::ProcessInstance;
        let json = serde_json::to_string(&vt).unwrap();
        let back: ValueType = serde_json::from_str(&json).unwrap();
        assert_eq!(back, ValueType::ProcessInstance);
    }

    #[test]
    fn test_value_type_serde_all_variants() {
        let variants = [
            ValueType::Deployment,
            ValueType::ProcessInstance,
            ValueType::Job,
            ValueType::Message,
            ValueType::Incident,
            ValueType::Variable,
            ValueType::UserTask,
            ValueType::Timer,
            ValueType::Signal,
        ];
        for vt in variants {
            let json = serde_json::to_string(&vt).unwrap();
            let back: ValueType = serde_json::from_str(&json).unwrap();
            assert_eq!(back, vt, "Serde round-trip failed for {:?}", vt);
        }
    }

    // ---- RecordType tests ----

    #[test]
    fn test_record_type_display() {
        assert_eq!(RecordType::Command.to_string(), "COMMAND");
        assert_eq!(RecordType::Event.to_string(), "EVENT");
        assert_eq!(RecordType::Rejection.to_string(), "REJECTION");
    }

    #[test]
    fn test_record_type_try_from_str_valid() {
        assert_eq!(RecordType::try_from("COMMAND").unwrap(), RecordType::Command);
        assert_eq!(RecordType::try_from("EVENT").unwrap(), RecordType::Event);
        assert_eq!(RecordType::try_from("REJECTION").unwrap(), RecordType::Rejection);
    }

    #[test]
    fn test_record_type_try_from_str_invalid() {
        let result = RecordType::try_from("UNKNOWN");
        assert!(result.is_err(), "Unknown record type should return an error");
    }

    #[test]
    fn test_record_type_serde_roundtrip() {
        let rt = RecordType::Command;
        let json = serde_json::to_string(&rt).unwrap();
        let back: RecordType = serde_json::from_str(&json).unwrap();
        assert_eq!(back, RecordType::Command);

        let rt = RecordType::Event;
        let json = serde_json::to_string(&rt).unwrap();
        let back: RecordType = serde_json::from_str(&json).unwrap();
        assert_eq!(back, RecordType::Event);
    }

    // ---- Record construction tests ----

    #[test]
    fn test_record_command_constructor() {
        let record = Record::command(
            1, 42,
            ValueType::ProcessInstanceCreation,
            "CREATE".to_string(),
            serde_json::json!({ "bpmnProcessId": "order-process" }),
        );
        assert_eq!(record.partition_id, 1);
        assert_eq!(record.key, 42);
        assert_eq!(record.record_type, RecordType::Command);
        assert_eq!(record.value_type, ValueType::ProcessInstanceCreation);
        assert_eq!(record.intent, "CREATE");
    }

    #[test]
    fn test_record_default_tenant() {
        let record = Record::command(
            1, 1, ValueType::ProcessInstance,
            "CREATE".to_string(),
            serde_json::Value::Null,
        );
        assert_eq!(record.tenant_id, "<default>");
    }

    #[test]
    fn test_record_event_constructor() {
        let record = Record::event(
            1, 100, ValueType::ProcessInstance,
            "ELEMENT_ACTIVATED".to_string(),
            serde_json::json!({}),
            Some(10),
        );
        assert_eq!(record.record_type, RecordType::Event);
        assert_eq!(record.intent, "ELEMENT_ACTIVATED");
        assert_eq!(record.source_position, Some(10));
    }

    #[test]
    fn test_record_rejection_constructor() {
        let record = Record::rejection(
            1, 200, ValueType::ProcessInstanceCreation,
            "CREATE".to_string(),
            serde_json::json!({ "message": "Process not found" }),
            Some(5),
        );
        assert_eq!(record.record_type, RecordType::Rejection);
        assert_eq!(record.source_position, Some(5));
    }

    #[test]
    fn test_record_with_tenant() {
        let record = Record::command(
            1, 1, ValueType::ProcessInstance,
            "CREATE".to_string(),
            serde_json::Value::Null,
        ).with_tenant("my-tenant");
        assert_eq!(record.tenant_id, "my-tenant");
    }

    #[test]
    fn test_record_with_source_position() {
        let record = Record::command(
            1, 1, ValueType::ProcessInstance,
            "ACTIVATE_ELEMENT".to_string(),
            serde_json::Value::Null,
        ).with_source_position(99);
        assert_eq!(record.source_position, Some(99));
    }

    #[test]
    fn test_record_serde_round_trip() {
        let record = Record::command(
            1, 42, ValueType::Job,
            "COMPLETE".to_string(),
            serde_json::json!({ "worker": "my-worker" }),
        );
        let json = serde_json::to_string(&record).unwrap();
        let back: Record = serde_json::from_str(&json).unwrap();
        assert_eq!(back.key, 42);
        assert_eq!(back.partition_id, 1);
        assert_eq!(back.intent, "COMPLETE");
        assert_eq!(back.record_type, RecordType::Command);
        assert_eq!(back.value_type, ValueType::Job);
    }

    #[test]
    fn test_record_broker_version_set() {
        let record = Record::command(
            1, 1, ValueType::Deployment,
            "CREATE".to_string(),
            serde_json::Value::Null,
        );
        assert!(!record.broker_version.is_empty());
    }

    // ---- Intent display tests ----

    #[test]
    fn test_process_instance_intent_display() {
        use crate::intent::ProcessInstanceIntent;
        assert_eq!(ProcessInstanceIntent::ActivateElement.to_string(), "ACTIVATE_ELEMENT");
        assert_eq!(ProcessInstanceIntent::ElementActivated.to_string(), "ELEMENT_ACTIVATED");
        assert_eq!(ProcessInstanceIntent::ElementCompleted.to_string(), "ELEMENT_COMPLETED");
        assert_eq!(ProcessInstanceIntent::Cancel.to_string(), "CANCEL");
        assert_eq!(ProcessInstanceIntent::SequenceFlowTaken.to_string(), "SEQUENCE_FLOW_TAKEN");
    }

    #[test]
    fn test_job_intent_display() {
        use crate::intent::JobIntent;
        assert_eq!(JobIntent::Complete.to_string(), "COMPLETE");
        assert_eq!(JobIntent::Completed.to_string(), "COMPLETED");
        assert_eq!(JobIntent::Create.to_string(), "CREATE");
        assert_eq!(JobIntent::Created.to_string(), "CREATED");
        assert_eq!(JobIntent::Fail.to_string(), "FAIL");
        assert_eq!(JobIntent::Failed.to_string(), "FAILED");
    }

    #[test]
    fn test_deployment_intent_display() {
        use crate::intent::DeploymentIntent;
        assert_eq!(DeploymentIntent::Create.to_string(), "CREATE");
        assert_eq!(DeploymentIntent::Created.to_string(), "CREATED");
        assert_eq!(DeploymentIntent::Distributed.to_string(), "DISTRIBUTED");
    }
}
