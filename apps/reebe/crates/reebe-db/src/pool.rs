use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct DbConfig {
    pub url: String,
    pub max_connections: u32,
    pub min_connections: u32,
    pub connection_timeout_secs: u64,
}

impl Default for DbConfig {
    fn default() -> Self {
        Self {
            url: "postgres://reebe:reebe@localhost:5432/reebe".to_string(),
            max_connections: 20,
            min_connections: 2,
            connection_timeout_secs: 30,
        }
    }
}

// ── PostgreSQL backend ────────────────────────────────────────────────────────

#[cfg(feature = "postgres")]
pub type DbPool = sqlx::PgPool;

#[cfg(feature = "postgres")]
pub async fn create_pool(config: &DbConfig) -> Result<DbPool, sqlx::Error> {
    use sqlx::postgres::PgPoolOptions;
    PgPoolOptions::new()
        .max_connections(config.max_connections)
        .min_connections(config.min_connections)
        .acquire_timeout(std::time::Duration::from_secs(config.connection_timeout_secs))
        .connect(&config.url)
        .await
}

#[cfg(feature = "postgres")]
pub async fn create_replica_pool(config: &DbConfig, replica_url: &str) -> Result<DbPool, sqlx::Error> {
    use sqlx::postgres::PgPoolOptions;
    PgPoolOptions::new()
        .max_connections(config.max_connections)
        .min_connections(1)
        .acquire_timeout(std::time::Duration::from_secs(config.connection_timeout_secs))
        .connect(replica_url)
        .await
}

#[cfg(feature = "postgres")]
pub async fn run_migrations(pool: &DbPool) -> Result<(), sqlx::migrate::MigrateError> {
    sqlx::migrate!("./migrations").run(pool).await
}

// ── SQLite backend ────────────────────────────────────────────────────────────

#[cfg(feature = "sqlite")]
pub type DbPool = sqlx::SqlitePool;

#[cfg(feature = "sqlite")]
pub async fn create_pool(config: &DbConfig) -> Result<DbPool, sqlx::Error> {
    use sqlx::sqlite::{SqliteConnectOptions, SqliteJournalMode, SqlitePoolOptions, SqliteSynchronous};
    use std::str::FromStr;
    let opts = SqliteConnectOptions::from_str(&config.url)?
        .create_if_missing(true)
        .journal_mode(SqliteJournalMode::Wal)
        .synchronous(SqliteSynchronous::Normal);
    SqlitePoolOptions::new()
        .max_connections(config.max_connections)
        .connect_with(opts)
        .await
}

#[cfg(feature = "sqlite")]
pub async fn create_replica_pool(_config: &DbConfig, _replica_url: &str) -> Result<DbPool, sqlx::Error> {
    Err(sqlx::Error::Configuration(
        "Read replica is not supported in SQLite easy mode".into(),
    ))
}

#[cfg(feature = "sqlite")]
pub async fn run_migrations(pool: &DbPool) -> Result<(), sqlx::migrate::MigrateError> {
    sqlx::migrate!("./migrations_sqlite").run(pool).await
}

// ── Guard ─────────────────────────────────────────────────────────────────────

#[cfg(not(any(feature = "postgres", feature = "sqlite", feature = "memory")))]
compile_error!("Either the 'postgres', 'sqlite', or 'memory' feature must be enabled for reebe-db.");
