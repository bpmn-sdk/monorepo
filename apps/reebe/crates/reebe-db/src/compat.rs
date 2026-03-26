//! Backend-agnostic type aliases used throughout the state layer.

#[cfg(feature = "postgres")]
pub type DbRow = sqlx::postgres::PgRow;

#[cfg(feature = "sqlite")]
pub type DbRow = sqlx::sqlite::SqliteRow;
