//! Core workflow engine for the Reebe workflow engine.
//!
//! This crate implements the event-sourced processing loop, BPMN element
//! execution, job management, message correlation, timers, incidents, and
//! user tasks.

pub mod clock;
pub mod engine;
pub mod error;
pub mod process_def_cache;
pub mod processor;
pub mod key_gen;
pub mod job_notifier;

// Server-only modules (not available on WASM)
#[cfg(not(target_arch = "wasm32"))]
pub mod replay;
#[cfg(not(target_arch = "wasm32"))]
pub mod routing;
#[cfg(not(target_arch = "wasm32"))]
pub mod stream;
#[cfg(not(target_arch = "wasm32"))]
pub mod scheduler;
#[cfg(not(target_arch = "wasm32"))]
pub mod tests;

pub use clock::{Clock, RealClock, VirtualClock};
pub use engine::{EngineConfig, EngineState};
pub use error::{EngineError, EngineResult};
pub use job_notifier::JobNotifier;

#[cfg(not(target_arch = "wasm32"))]
pub use engine::{Engine, EngineHandle};

/// Evaluate a FEEL expression in the context of process variables.
pub fn evaluate_feel(
    expression: &str,
    variables: &serde_json::Value,
) -> Result<serde_json::Value, EngineError> {
    use reebe_feel::{FeelContext, parse_and_evaluate};
    let ctx = FeelContext::from_json(variables.clone());
    parse_and_evaluate(expression, &ctx)
        .map(serde_json::Value::from)
        .map_err(|e| EngineError::Expression(e.to_string()))
}
