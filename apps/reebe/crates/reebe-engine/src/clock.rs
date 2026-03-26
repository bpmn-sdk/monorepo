use std::sync::{Arc, Mutex};
use chrono::{DateTime, Duration, Utc};

/// Injectable clock for testability and WASM virtual time support.
pub trait Clock: Send + Sync {
    fn now(&self) -> DateTime<Utc>;
}

/// Real wall-clock time. Used in server builds.
pub struct RealClock;

impl Clock for RealClock {
    fn now(&self) -> DateTime<Utc> {
        Utc::now()
    }
}

/// Virtual clock for WASM playground and tests.
/// Time is manually advanced via `advance()` or `set()`.
pub struct VirtualClock {
    current: Arc<Mutex<DateTime<Utc>>>,
}

impl VirtualClock {
    pub fn new(start: DateTime<Utc>) -> Self {
        Self { current: Arc::new(Mutex::new(start)) }
    }

    pub fn advance(&self, duration: Duration) {
        let mut t = self.current.lock().unwrap();
        *t = *t + duration;
    }

    pub fn set(&self, t: DateTime<Utc>) {
        *self.current.lock().unwrap() = t;
    }
}

impl Clock for VirtualClock {
    fn now(&self) -> DateTime<Utc> {
        *self.current.lock().unwrap()
    }
}
