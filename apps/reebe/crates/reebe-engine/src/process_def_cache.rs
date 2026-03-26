//! In-memory process definition cache.
//!
//! Avoids a DB round-trip on every element activation by keeping the parsed
//! BPMN processes in memory. Keyed by (bpmn_process_id, version, tenant_id)
//! and process_definition_key.

use std::sync::Arc;
use dashmap::DashMap;
use reebe_bpmn::BpmnProcess;

/// Key for a process definition in the cache.
#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct ProcessDefKey {
    pub bpmn_process_id: String,
    pub version: i32,
    pub tenant_id: String,
}

/// Cached process definition entry.
#[derive(Clone)]
pub struct CachedProcessDef {
    pub key: i64,
    pub bpmn_process_id: String,
    pub version: i32,
    pub tenant_id: String,
    /// The parsed BPMN processes from the deployment resource.
    pub processes: Arc<Vec<BpmnProcess>>,
}

/// Thread-safe in-memory cache for process definitions.
#[derive(Clone, Default)]
pub struct ProcessDefCache {
    /// By (bpmn_process_id, version, tenant_id)
    by_id_version: Arc<DashMap<ProcessDefKey, Arc<CachedProcessDef>>>,
    /// By process_definition_key (the i64 DB key)
    by_key: Arc<DashMap<i64, Arc<CachedProcessDef>>>,
}

impl ProcessDefCache {
    pub fn new() -> Self {
        Self::default()
    }

    /// Insert a process definition into the cache.
    pub fn insert(&self, def: CachedProcessDef) {
        let def = Arc::new(def);
        let id_key = ProcessDefKey {
            bpmn_process_id: def.bpmn_process_id.clone(),
            version: def.version,
            tenant_id: def.tenant_id.clone(),
        };
        self.by_id_version.insert(id_key, def.clone());
        self.by_key.insert(def.key, def);
    }

    /// Look up by process_definition_key.
    pub fn get_by_key(&self, key: i64) -> Option<Arc<CachedProcessDef>> {
        self.by_key.get(&key).map(|r| r.clone())
    }

    /// Look up by bpmn_process_id + version + tenant.
    pub fn get_by_id_version(
        &self,
        id: &str,
        version: i32,
        tenant_id: &str,
    ) -> Option<Arc<CachedProcessDef>> {
        let key = ProcessDefKey {
            bpmn_process_id: id.to_string(),
            version,
            tenant_id: tenant_id.to_string(),
        };
        self.by_id_version.get(&key).map(|r| r.clone())
    }

    /// Get the latest version of a process by bpmn_process_id + tenant.
    pub fn get_latest(&self, id: &str, tenant_id: &str) -> Option<Arc<CachedProcessDef>> {
        self.by_id_version
            .iter()
            .filter(|entry| {
                entry.key().bpmn_process_id == id && entry.key().tenant_id == tenant_id
            })
            .max_by_key(|entry| entry.key().version)
            .map(|entry| entry.value().clone())
    }

    /// Number of cached definitions.
    pub fn len(&self) -> usize {
        self.by_key.len()
    }

    /// Returns true if the cache is empty.
    pub fn is_empty(&self) -> bool {
        self.by_key.is_empty()
    }
}
