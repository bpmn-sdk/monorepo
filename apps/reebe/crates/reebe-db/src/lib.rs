pub mod backend;
#[cfg(any(feature = "postgres", feature = "sqlite"))]
pub mod compat;
pub mod error;
#[cfg(any(feature = "postgres", feature = "sqlite"))]
pub mod pool;
pub mod records;
pub mod state;

#[cfg(any(feature = "postgres", feature = "sqlite"))]
pub mod sqlx_backend;

#[cfg(feature = "memory")]
pub mod memory_backend;

pub use backend::StateBackend;
#[cfg(any(feature = "postgres", feature = "sqlite"))]
pub use compat::DbRow;
pub use error::DbError;
#[cfg(any(feature = "postgres", feature = "sqlite"))]
pub use pool::{DbPool, DbConfig, create_pool};
#[cfg(any(feature = "postgres", feature = "sqlite"))]
pub use sqlx_backend::SqlxBackend;
#[cfg(feature = "memory")]
pub use memory_backend::InMemoryBackend;

pub type Result<T> = std::result::Result<T, DbError>;
