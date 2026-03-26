use std::sync::Arc;
use async_trait::async_trait;
use reebe_db::records::DbRecord;
use reebe_db::state::identity::{Tenant, User};
use crate::engine::EngineState;
use crate::error::{EngineError, EngineResult};
use crate::key_gen::KeyGenerator;
use super::{EventToWrite, RecordProcessor, Writers};

pub struct IdentityProcessor;

#[async_trait]
impl RecordProcessor for IdentityProcessor {
    fn accepts(&self, value_type: &str, intent: &str) -> bool {
        matches!(value_type, "USER" | "TENANT")
            && matches!(intent, "CREATE" | "DELETE" | "UPDATE")
    }

    async fn process(
        &self,
        record: &DbRecord,
        state: &EngineState,
        writers: &mut Writers,
    ) -> EngineResult<()> {
        match (record.value_type.as_str(), record.intent.as_str()) {
            ("TENANT", "CREATE") => self.create_tenant(record, state, writers).await,
            ("USER", "CREATE") => self.create_user(record, state, writers).await,
            ("USER", "DELETE") => self.delete_user(record, state, writers).await,
            _ => Ok(()),
        }
    }
}

impl IdentityProcessor {
    async fn create_tenant(
        &self,
        record: &DbRecord,
        state: &EngineState,
        writers: &mut Writers,
    ) -> EngineResult<()> {
        let key_gen = KeyGenerator::new(Arc::clone(&state.backend), state.partition_id);
        let payload = &record.payload;

        let tenant_id_str = payload["tenantId"]
            .as_str()
            .unwrap_or("")
            .to_string();
        let name = payload["name"].as_str().map(|s| s.to_string());

        let key = key_gen.next_key().await?;
        let tenant = Tenant {
            key,
            tenant_id: tenant_id_str.clone(),
            name: name.clone(),
            created_at: state.clock.now(),
        };
        state.backend.insert_tenant(&tenant).await?;

        writers.events.push(EventToWrite {
            value_type: "TENANT".to_string(),
            intent: "CREATED".to_string(),
            key,
            payload: serde_json::json!({
                "tenantKey": key.to_string(),
                "tenantId": tenant_id_str,
                "name": name,
            }),
        });

        writers.response = Some(serde_json::json!({
            "tenantKey": key.to_string(),
            "tenantId": tenant_id_str,
            "name": name,
        }));

        Ok(())
    }

    async fn create_user(
        &self,
        record: &DbRecord,
        state: &EngineState,
        writers: &mut Writers,
    ) -> EngineResult<()> {
        let payload = &record.payload;

        let username = payload["username"]
            .as_str()
            .ok_or_else(|| EngineError::InvalidState("Missing username".to_string()))?
            .to_string();
        let email = payload["email"].as_str().map(|s| s.to_string());
        let name = payload["name"].as_str().map(|s| s.to_string());

        let password_hash = payload["passwordHash"].as_str().map(|s| s.to_string());

        let user = User {
            username: username.clone(),
            name: name.clone(),
            email: email.clone(),
            password_hash,
            enabled: true,
            created_at: state.clock.now(),
        };
        state.backend.insert_user(&user).await?;

        writers.events.push(EventToWrite {
            value_type: "USER".to_string(),
            intent: "CREATED".to_string(),
            key: 0,
            payload: serde_json::json!({
                "username": username,
                "email": email,
                "name": name,
            }),
        });

        writers.response = Some(serde_json::json!({
            "username": username,
            "email": email,
            "name": name,
        }));

        Ok(())
    }

    async fn delete_user(
        &self,
        record: &DbRecord,
        state: &EngineState,
        writers: &mut Writers,
    ) -> EngineResult<()> {
        let payload = &record.payload;

        let username = payload["username"]
            .as_str()
            .ok_or_else(|| EngineError::InvalidState("Missing username".to_string()))?
            .to_string();

        state.backend.delete_user(&username).await?;

        writers.events.push(EventToWrite {
            value_type: "USER".to_string(),
            intent: "DELETED".to_string(),
            key: 0,
            payload: serde_json::json!({
                "username": username,
            }),
        });

        writers.response = Some(serde_json::json!({}));
        Ok(())
    }
}
