use dashmap::DashMap;
use std::sync::Arc;

/// Pub/sub notifier for job availability per job type.
/// Used for long-polling job activation (server only).
/// On WASM targets this is a no-op.
pub struct JobNotifier {
    #[cfg(not(target_arch = "wasm32"))]
    notifiers: DashMap<String, Arc<tokio::sync::Notify>>,
    // On WASM: zero-size, no fields needed
    #[cfg(target_arch = "wasm32")]
    _phantom: std::marker::PhantomData<()>,
}

impl Default for JobNotifier {
    fn default() -> Self {
        Self::new()
    }
}

impl JobNotifier {
    pub fn new() -> Self {
        Self {
            #[cfg(not(target_arch = "wasm32"))]
            notifiers: DashMap::new(),
            #[cfg(target_arch = "wasm32")]
            _phantom: std::marker::PhantomData,
        }
    }

    /// Notify all waiters for a given job type that jobs are available.
    pub fn notify(&self, _job_type: &str) {
        #[cfg(not(target_arch = "wasm32"))]
        if let Some(notify) = self.notifiers.get(_job_type) {
            notify.notify_waiters();
        }
    }

    /// Get or create a Notify for the given job type (server only).
    #[cfg(not(target_arch = "wasm32"))]
    pub fn get_or_create(&self, job_type: &str) -> Arc<tokio::sync::Notify> {
        self.notifiers
            .entry(job_type.to_string())
            .or_insert_with(|| Arc::new(tokio::sync::Notify::new()))
            .clone()
    }
}
