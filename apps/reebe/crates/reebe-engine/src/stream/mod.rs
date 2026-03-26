#[cfg(any(feature = "postgres", feature = "sqlite"))]
use std::sync::Arc;
#[cfg(any(feature = "postgres", feature = "sqlite"))]
use std::time::Duration;
#[cfg(any(feature = "postgres", feature = "sqlite"))]
use reebe_db::DbPool;
#[cfg(any(feature = "postgres", feature = "sqlite"))]
use reebe_db::records::RecordRepository;
#[cfg(any(feature = "postgres", feature = "sqlite"))]
use crate::engine::Engine;

#[cfg(any(feature = "postgres", feature = "sqlite"))]
pub struct StreamProcessor {
    pub engine: Arc<Engine>,
    pub partition_id: i16,
    pub pool: DbPool,
}

#[cfg(any(feature = "postgres", feature = "sqlite"))]
impl StreamProcessor {
    pub fn new(engine: Arc<Engine>, partition_id: i16, pool: DbPool) -> Self {
        Self { engine, partition_id, pool }
    }

    pub async fn run(&self) {
        let mut last_position: i64 = 0;
        loop {
            let repo = RecordRepository::new(&self.pool);
            match repo.fetch_commands_from(self.partition_id, last_position + 1, 100).await {
                Ok(records) if !records.is_empty() => {
                    for record in &records {
                        last_position = record.position;
                        self.engine.process_one(record).await;
                    }
                }
                Ok(_) => {
                    tokio::time::sleep(Duration::from_millis(5)).await;
                }
                Err(e) => {
                    tracing::error!("StreamProcessor: error fetching records: {}", e);
                    tokio::time::sleep(Duration::from_millis(100)).await;
                }
            }
        }
    }
}
