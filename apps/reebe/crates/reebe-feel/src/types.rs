use std::collections::HashMap;
use std::fmt;
use thiserror::Error;

#[derive(Debug, Clone, PartialEq)]
pub enum FeelValue {
    Null,
    Bool(bool),
    Integer(i64),
    Float(f64),
    String(String),
    List(Vec<FeelValue>),
    Context(HashMap<String, FeelValue>),
    Date(chrono::NaiveDate),
    Time(chrono::NaiveTime),
    DateTime(chrono::DateTime<chrono::Utc>),
    /// Duration in milliseconds (for simplicity)
    Duration(i64),
    Range {
        start: Box<FeelValue>,
        end: Box<FeelValue>,
        start_inclusive: bool,
        end_inclusive: bool,
    },
}

impl FeelValue {
    /// Check if a value is truthy (for boolean conditions)
    pub fn is_truthy(&self) -> bool {
        match self {
            FeelValue::Bool(b) => *b,
            FeelValue::Null => false,
            _ => true,
        }
    }

    /// Get the type name as a string
    pub fn type_name(&self) -> &'static str {
        match self {
            FeelValue::Null => "null",
            FeelValue::Bool(_) => "boolean",
            FeelValue::Integer(_) => "number",
            FeelValue::Float(_) => "number",
            FeelValue::String(_) => "string",
            FeelValue::List(_) => "list",
            FeelValue::Context(_) => "context",
            FeelValue::Date(_) => "date",
            FeelValue::Time(_) => "time",
            FeelValue::DateTime(_) => "date and time",
            FeelValue::Duration(_) => "duration",
            FeelValue::Range { .. } => "range",
        }
    }

    /// Attempt to convert to a number (i64 or f64 stored as Float)
    pub fn as_number_f64(&self) -> Option<f64> {
        match self {
            FeelValue::Integer(i) => Some(*i as f64),
            FeelValue::Float(f) => Some(*f),
            _ => None,
        }
    }

    /// Check if this value is contained in a range
    pub fn in_range(&self, range: &FeelValue) -> bool {
        match range {
            FeelValue::Range {
                start,
                end,
                start_inclusive,
                end_inclusive,
            } => {
                let start_ok = if *start_inclusive {
                    compare_values(self, start) >= Some(std::cmp::Ordering::Equal)
                } else {
                    compare_values(self, start) == Some(std::cmp::Ordering::Greater)
                };
                let end_ok = if *end_inclusive {
                    compare_values(self, end) <= Some(std::cmp::Ordering::Equal)
                } else {
                    compare_values(self, end) == Some(std::cmp::Ordering::Less)
                };
                start_ok && end_ok
            }
            _ => false,
        }
    }
}

/// Compare two FeelValues for ordering purposes.
pub fn compare_values(a: &FeelValue, b: &FeelValue) -> Option<std::cmp::Ordering> {
    match (a, b) {
        (FeelValue::Integer(x), FeelValue::Integer(y)) => Some(x.cmp(y)),
        (FeelValue::Float(x), FeelValue::Float(y)) => x.partial_cmp(y),
        (FeelValue::Integer(x), FeelValue::Float(y)) => (*x as f64).partial_cmp(y),
        (FeelValue::Float(x), FeelValue::Integer(y)) => x.partial_cmp(&(*y as f64)),
        (FeelValue::String(x), FeelValue::String(y)) => Some(x.cmp(y)),
        (FeelValue::Date(x), FeelValue::Date(y)) => Some(x.cmp(y)),
        (FeelValue::DateTime(x), FeelValue::DateTime(y)) => Some(x.cmp(y)),
        (FeelValue::Duration(x), FeelValue::Duration(y)) => Some(x.cmp(y)),
        _ => None,
    }
}

impl fmt::Display for FeelValue {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            FeelValue::Null => write!(f, "null"),
            FeelValue::Bool(b) => write!(f, "{}", b),
            FeelValue::Integer(i) => write!(f, "{}", i),
            FeelValue::Float(v) => write!(f, "{}", v),
            FeelValue::String(s) => write!(f, "{}", s),
            FeelValue::List(items) => {
                write!(f, "[")?;
                for (i, item) in items.iter().enumerate() {
                    if i > 0 {
                        write!(f, ", ")?;
                    }
                    write!(f, "{}", item)?;
                }
                write!(f, "]")
            }
            FeelValue::Context(map) => {
                write!(f, "{{")?;
                for (i, (k, v)) in map.iter().enumerate() {
                    if i > 0 {
                        write!(f, ", ")?;
                    }
                    write!(f, "{}: {}", k, v)?;
                }
                write!(f, "}}")
            }
            FeelValue::Date(d) => write!(f, "{}", d),
            FeelValue::Time(t) => write!(f, "{}", t),
            FeelValue::DateTime(dt) => write!(f, "{}", dt),
            FeelValue::Duration(ms) => write!(f, "duration({}ms)", ms),
            FeelValue::Range {
                start,
                end,
                start_inclusive,
                end_inclusive,
            } => {
                write!(
                    f,
                    "{}{}..{}{}",
                    if *start_inclusive { "[" } else { "(" },
                    start,
                    end,
                    if *end_inclusive { "]" } else { ")" }
                )
            }
        }
    }
}

/// Convert a serde_json::Value to a FeelValue
impl From<serde_json::Value> for FeelValue {
    fn from(v: serde_json::Value) -> Self {
        match v {
            serde_json::Value::Null => FeelValue::Null,
            serde_json::Value::Bool(b) => FeelValue::Bool(b),
            serde_json::Value::Number(n) => {
                if let Some(i) = n.as_i64() {
                    FeelValue::Integer(i)
                } else if let Some(f) = n.as_f64() {
                    FeelValue::Float(f)
                } else {
                    FeelValue::Null
                }
            }
            serde_json::Value::String(s) => FeelValue::String(s),
            serde_json::Value::Array(arr) => {
                FeelValue::List(arr.into_iter().map(FeelValue::from).collect())
            }
            serde_json::Value::Object(obj) => {
                FeelValue::Context(obj.into_iter().map(|(k, v)| (k, FeelValue::from(v))).collect())
            }
        }
    }
}

impl From<FeelValue> for serde_json::Value {
    fn from(v: FeelValue) -> Self {
        match v {
            FeelValue::Null => serde_json::Value::Null,
            FeelValue::Bool(b) => serde_json::Value::Bool(b),
            FeelValue::Integer(i) => serde_json::Value::Number(i.into()),
            FeelValue::Float(f) => {
                serde_json::Number::from_f64(f)
                    .map(serde_json::Value::Number)
                    .unwrap_or(serde_json::Value::Null)
            }
            FeelValue::String(s) => serde_json::Value::String(s),
            FeelValue::List(items) => {
                serde_json::Value::Array(items.into_iter().map(serde_json::Value::from).collect())
            }
            FeelValue::Context(map) => serde_json::Value::Object(
                map.into_iter()
                    .map(|(k, v)| (k, serde_json::Value::from(v)))
                    .collect(),
            ),
            FeelValue::Date(d) => serde_json::Value::String(d.to_string()),
            FeelValue::Time(t) => serde_json::Value::String(t.to_string()),
            FeelValue::DateTime(dt) => serde_json::Value::String(dt.to_rfc3339()),
            FeelValue::Duration(ms) => serde_json::Value::Number(ms.into()),
            FeelValue::Range { .. } => serde_json::Value::Null,
        }
    }
}

#[derive(Debug, Error, Clone, PartialEq)]
pub enum FeelError {
    #[error("Lexer error: {0}")]
    LexerError(String),

    #[error("Parse error: {0}")]
    ParseError(String),

    #[error("Evaluation error: {0}")]
    EvaluationError(String),

    #[error("Type error: expected {expected}, got {actual}")]
    TypeError {
        expected: String,
        actual: String,
    },

    #[error("Undefined variable: {0}")]
    UndefinedVariable(String),

    #[error("Undefined function: {0}")]
    UndefinedFunction(String),

    #[error("Division by zero")]
    DivisionByZero,

    #[error("Index out of bounds: index {index}, length {length}")]
    IndexOutOfBounds { index: i64, length: usize },
}
