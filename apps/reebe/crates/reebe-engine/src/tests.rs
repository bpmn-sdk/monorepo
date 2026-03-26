#[cfg(test)]
mod tests {
    use crate::job_notifier::JobNotifier;
    use crate::error::EngineError;
    use crate::processor::{Writers, EventToWrite, CommandToWrite};
    use std::sync::Arc;

    // ---- JobNotifier tests ----

    #[tokio::test]
    async fn test_job_notifier_creates_entry() {
        let notifier = JobNotifier::new();
        let n1 = notifier.get_or_create("payment-task");
        let n2 = notifier.get_or_create("payment-task");
        // Same job type returns same notifier (same Arc pointer)
        assert!(Arc::ptr_eq(&n1, &n2));
    }

    #[tokio::test]
    async fn test_job_notifier_different_types() {
        let notifier = JobNotifier::new();
        let n1 = notifier.get_or_create("type-a");
        let n2 = notifier.get_or_create("type-b");
        assert!(!Arc::ptr_eq(&n1, &n2));
    }

    #[tokio::test]
    async fn test_job_notifier_notify_wakes_waiter() {
        let notifier = Arc::new(JobNotifier::new());
        let notif = notifier.get_or_create("my-job-type");

        let notif_clone = notif.clone();
        let task = tokio::spawn(async move {
            // Will block until notified
            notif_clone.notified().await;
        });

        // Small delay then notify
        tokio::time::sleep(std::time::Duration::from_millis(10)).await;
        notifier.notify("my-job-type");

        // Task should complete quickly
        let result = tokio::time::timeout(
            std::time::Duration::from_millis(200),
            task,
        ).await;
        assert!(result.is_ok(), "Task should have been woken up by notify");
    }

    #[tokio::test]
    async fn test_job_notifier_notify_nonexistent_type() {
        let notifier = JobNotifier::new();
        // Should not panic on notifying a type with no waiters
        notifier.notify("nobody-waiting");
    }

    #[test]
    fn test_job_notifier_default() {
        let notifier = JobNotifier::default();
        let n = notifier.get_or_create("test");
        assert!(Arc::strong_count(&n) >= 1);
    }

    // ---- Writers tests ----

    #[test]
    fn test_writers_initial_state() {
        let writers = Writers::new();
        assert!(writers.events.is_empty());
        assert!(writers.commands.is_empty());
        assert!(writers.response.is_none());
        assert!(writers.rejection.is_none());
    }

    #[test]
    fn test_writers_default_matches_new() {
        let w1 = Writers::new();
        let w2 = Writers::default();
        assert!(w1.events.is_empty());
        assert!(w2.events.is_empty());
    }

    #[test]
    fn test_writers_add_event() {
        let mut writers = Writers::new();
        writers.events.push(EventToWrite {
            value_type: "PROCESS_INSTANCE".to_string(),
            intent: "ELEMENT_ACTIVATED".to_string(),
            key: 12345,
            payload: serde_json::json!({ "elementId": "start" }),
        });
        assert_eq!(writers.events.len(), 1);
        assert_eq!(writers.events[0].intent, "ELEMENT_ACTIVATED");
        assert_eq!(writers.events[0].key, 12345);
        assert_eq!(writers.events[0].value_type, "PROCESS_INSTANCE");
    }

    #[test]
    fn test_writers_add_command() {
        let mut writers = Writers::new();
        writers.commands.push(CommandToWrite {
            value_type: "PROCESS_INSTANCE".to_string(),
            intent: "ACTIVATE_ELEMENT".to_string(),
            key: 0,
            payload: serde_json::json!({ "elementId": "task1" }),
        });
        assert_eq!(writers.commands.len(), 1);
        assert_eq!(writers.commands[0].intent, "ACTIVATE_ELEMENT");
    }

    #[test]
    fn test_writers_set_response() {
        let mut writers = Writers::new();
        writers.response = Some(serde_json::json!({ "processInstanceKey": "123" }));
        assert!(writers.response.is_some());
        let resp = writers.response.unwrap();
        assert_eq!(resp["processInstanceKey"], "123");
    }

    #[test]
    fn test_writers_set_rejection() {
        let mut writers = Writers::new();
        writers.rejection = Some("Process not found".to_string());
        assert!(writers.rejection.is_some());
        assert_eq!(writers.rejection.as_deref(), Some("Process not found"));
    }

    #[test]
    fn test_writers_multiple_events() {
        let mut writers = Writers::new();
        for i in 0..5 {
            writers.events.push(EventToWrite {
                value_type: "PROCESS_INSTANCE".to_string(),
                intent: format!("INTENT_{}", i),
                key: i as i64,
                payload: serde_json::Value::Null,
            });
        }
        assert_eq!(writers.events.len(), 5);
    }

    // ---- EngineError tests ----

    #[test]
    fn test_engine_error_not_found_display() {
        let e = EngineError::NotFound("Process definition 42".to_string());
        assert!(e.to_string().contains("Process definition 42"));
        assert!(e.to_string().contains("Not found"));
    }

    #[test]
    fn test_engine_error_invalid_state_display() {
        let e = EngineError::InvalidState("Element not in expected state".to_string());
        assert!(e.to_string().contains("Element not in expected state"));
    }

    #[test]
    fn test_engine_error_bpmn_parse_display() {
        let e = EngineError::BpmnParse("Invalid XML".to_string());
        assert!(e.to_string().contains("Invalid XML"));
    }

    #[test]
    fn test_engine_error_expression_display() {
        let e = EngineError::Expression("Unknown variable".to_string());
        assert!(e.to_string().contains("Unknown variable"));
    }

    #[test]
    fn test_engine_error_internal_display() {
        let e = EngineError::Internal("Something went wrong".to_string());
        assert!(e.to_string().contains("Something went wrong"));
    }

    // ---- evaluate_feel integration tests ----

    #[test]
    fn test_evaluate_feel_condition_true() {
        let vars = serde_json::json!({ "amount": 150 });
        let result = crate::evaluate_feel("=amount > 100", &vars).unwrap();
        assert_eq!(result, serde_json::Value::Bool(true));
    }

    #[test]
    fn test_evaluate_feel_condition_false() {
        let vars = serde_json::json!({ "amount": 50 });
        let result = crate::evaluate_feel("=amount > 100", &vars).unwrap();
        assert_eq!(result, serde_json::Value::Bool(false));
    }

    #[test]
    fn test_evaluate_feel_static_string() {
        let vars = serde_json::json!({});
        // No `=` prefix → treated as string literal
        let result = crate::evaluate_feel("payment-service", &vars).unwrap();
        assert_eq!(result, serde_json::Value::String("payment-service".to_string()));
    }

    #[test]
    fn test_evaluate_feel_variable_reference() {
        let vars = serde_json::json!({ "orderId": "order-123" });
        let result = crate::evaluate_feel("=orderId", &vars).unwrap();
        assert_eq!(result, serde_json::Value::String("order-123".to_string()));
    }

    #[test]
    fn test_evaluate_feel_complex_condition() {
        let vars = serde_json::json!({ "status": "approved", "amount": 500 });
        let result = crate::evaluate_feel("=status = \"approved\" and amount > 100", &vars).unwrap();
        assert_eq!(result, serde_json::Value::Bool(true));
    }

    #[test]
    fn test_evaluate_feel_returns_error_on_undefined_variable() {
        let vars = serde_json::json!({});
        // Accessing an undefined variable with strict evaluation should return an error
        let result = crate::evaluate_feel("=nonexistent + 1", &vars);
        assert!(result.is_err(), "Should return error for undefined variable");
    }

    // ---- FEEL integration tests (direct API) ----

    #[test]
    fn test_feel_evaluate_correlation_key() {
        use reebe_feel::{evaluate, FeelContext, FeelValue};
        let mut ctx = FeelContext::new();
        ctx.set("customerId", FeelValue::Integer(42));
        let result = evaluate("string(customerId)", &ctx).unwrap();
        assert_eq!(result, FeelValue::String("42".to_string()));
    }

    #[test]
    fn test_feel_parse_and_evaluate_with_prefix() {
        use reebe_feel::{parse_and_evaluate, FeelContext, FeelValue};
        let mut ctx = FeelContext::new();
        ctx.set("x", FeelValue::Integer(10));
        let result = parse_and_evaluate("=x * 2", &ctx).unwrap();
        assert_eq!(result, FeelValue::Integer(20));
    }

    #[test]
    fn test_feel_parse_and_evaluate_without_prefix() {
        use reebe_feel::{parse_and_evaluate, FeelContext};
        let ctx = FeelContext::new();
        use reebe_feel::FeelValue;
        let result = parse_and_evaluate("literal-value", &ctx).unwrap();
        assert_eq!(result, FeelValue::String("literal-value".to_string()));
    }

    #[test]
    fn test_feel_is_expression() {
        use reebe_feel::is_feel_expression;
        assert!(is_feel_expression("=amount > 0"));
        assert!(!is_feel_expression("my-job-type"));
        assert!(!is_feel_expression(""));
    }

    // ---- BPMN + FEEL integration ----

    #[test]
    fn test_bpmn_condition_expression_evaluates() {
        // Build process model with conditions directly (parser doesn't support inline conditionExpression
        // in non-self-closing sequenceFlow elements).
        use reebe_bpmn::model::{BpmnProcess, SequenceFlow};
        use reebe_feel::{parse_and_evaluate, FeelContext, FeelValue};

        let mut process = BpmnProcess::new("p");
        process.sequence_flows.push(SequenceFlow {
            id: "high".to_string(),
            name: None,
            source_ref: "gw".to_string(),
            target_ref: "end".to_string(),
            condition_expression: Some("=priority = \"high\"".to_string()),
            is_default: false,
        });
        process.sequence_flows.push(SequenceFlow {
            id: "low".to_string(),
            name: None,
            source_ref: "gw".to_string(),
            target_ref: "end".to_string(),
            condition_expression: Some("=priority != \"high\"".to_string()),
            is_default: false,
        });

        // Get condition from "high" flow
        let high_flow = process.sequence_flows.iter().find(|f| f.id == "high").unwrap();
        let condition = high_flow.condition_expression.as_ref().unwrap();

        let mut ctx = FeelContext::new();
        ctx.set("priority", FeelValue::String("high".to_string()));
        let result = parse_and_evaluate(condition, &ctx).unwrap();
        assert_eq!(result, FeelValue::Bool(true));

        ctx.set("priority", FeelValue::String("low".to_string()));
        let result = parse_and_evaluate(condition, &ctx).unwrap();
        assert_eq!(result, FeelValue::Bool(false));
    }
}
