use crate::types::FeelValue;
use std::collections::HashMap;

/// The evaluation context for FEEL expressions.
/// Variables are looked up by name, supporting nested scope chains.
#[derive(Debug, Clone, Default)]
pub struct FeelContext {
    bindings: HashMap<String, FeelValue>,
    parent: Option<Box<FeelContext>>,
}

impl FeelContext {
    pub fn new() -> Self {
        Self {
            bindings: HashMap::new(),
            parent: None,
        }
    }

    /// Create a child context with a reference to this context as parent.
    pub fn child(parent: FeelContext) -> Self {
        Self {
            bindings: HashMap::new(),
            parent: Some(Box::new(parent)),
        }
    }

    /// Set a variable in the current (innermost) scope.
    pub fn set(&mut self, name: impl Into<String>, value: FeelValue) {
        self.bindings.insert(name.into(), value);
    }

    /// Look up a variable by name, walking up the scope chain if not found locally.
    pub fn get(&self, name: &str) -> Option<&FeelValue> {
        if let Some(v) = self.bindings.get(name) {
            return Some(v);
        }
        if let Some(parent) = &self.parent {
            return parent.get(name);
        }
        None
    }

    /// Build a FeelContext from a serde_json::Value (must be an object).
    pub fn from_json(value: serde_json::Value) -> Self {
        let mut ctx = Self::new();
        if let serde_json::Value::Object(map) = value {
            for (k, v) in map {
                ctx.set(k, FeelValue::from(v));
            }
        }
        ctx
    }

    /// Convert this context to a FeelValue::Context map (shallow - only this scope's bindings).
    pub fn to_feel_value(&self) -> FeelValue {
        FeelValue::Context(self.bindings.clone())
    }

    /// Return an iterator over all bindings in this scope only.
    pub fn bindings(&self) -> &HashMap<String, FeelValue> {
        &self.bindings
    }
}

impl From<serde_json::Value> for FeelContext {
    fn from(v: serde_json::Value) -> Self {
        Self::from_json(v)
    }
}

impl From<HashMap<String, FeelValue>> for FeelContext {
    fn from(bindings: HashMap<String, FeelValue>) -> Self {
        Self {
            bindings,
            parent: None,
        }
    }
}
