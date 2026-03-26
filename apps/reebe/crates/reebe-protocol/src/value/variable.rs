use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VariableRecordValue {
    pub name: String,
    pub value: String,
    pub scope_key: i64,
    pub process_instance_key: i64,
    pub process_definition_key: i64,
    pub bpmn_process_id: String,
    pub tenant_id: String,
}

impl VariableRecordValue {
    pub fn new(
        name: impl Into<String>,
        value: impl Into<String>,
        scope_key: i64,
        process_instance_key: i64,
    ) -> Self {
        Self {
            name: name.into(),
            value: value.into(),
            scope_key,
            process_instance_key,
            process_definition_key: -1,
            bpmn_process_id: String::new(),
            tenant_id: "<default>".to_string(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VariableDocumentRecordValue {
    pub scope_key: i64,
    pub update_semantics: VariableUpdateSemantics,
    pub variables: serde_json::Value,
    pub process_instance_key: i64,
    pub bpmn_process_id: String,
    pub process_definition_key: i64,
    pub tenant_id: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum VariableUpdateSemantics {
    /// Merge variables into the scope (add/update, don't delete)
    Merge,
    /// Propagate variables up to the parent scope
    Propagate,
    /// Set only in the local scope (don't propagate)
    Local,
}
