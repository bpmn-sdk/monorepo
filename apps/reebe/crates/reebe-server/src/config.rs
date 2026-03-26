use serde::{Deserialize, Serialize};
use reebe_api::AuthConfig;

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct Config {
    pub server: ServerConfig,
    pub database: DatabaseConfig,
    pub engine: EngineConfig,
    /// Authentication configuration. Disabled by default.
    #[serde(default)]
    pub auth: AuthConfig,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct ServerConfig {
    pub host: String,
    pub port: u16,
}

impl Default for ServerConfig {
    fn default() -> Self {
        Self {
            host: "0.0.0.0".to_string(),
            port: 8080,
        }
    }
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct DatabaseConfig {
    pub url: String,
    pub max_connections: u32,
    /// Optional read replica URL. When set, read-only API handlers route
    /// queries here to keep the primary dedicated to engine writes.
    #[serde(default)]
    pub replica_url: Option<String>,
}

impl Default for DatabaseConfig {
    fn default() -> Self {
        Self {
            url: "postgres://reebe:reebe@localhost:5432/reebe".to_string(),
            max_connections: 20,
            replica_url: None,
        }
    }
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct EngineConfig {
    pub partition_count: u32,
    pub node_id: u32,
}

impl Default for EngineConfig {
    fn default() -> Self {
        Self {
            partition_count: 1,
            node_id: 0,
        }
    }
}

impl Default for Config {
    fn default() -> Self {
        Self {
            server: ServerConfig::default(),
            database: DatabaseConfig::default(),
            engine: EngineConfig::default(),
            auth: AuthConfig::default(),
        }
    }
}

impl From<&DatabaseConfig> for reebe_db::DbConfig {
    fn from(c: &DatabaseConfig) -> Self {
        reebe_db::DbConfig {
            url: c.url.clone(),
            max_connections: c.max_connections,
            min_connections: 2,
            connection_timeout_secs: 30,
        }
    }
}
