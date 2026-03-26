use serde::Serialize;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TopologyResponse {
    pub brokers: Vec<BrokerInfo>,
    pub cluster_size: i32,
    pub partitions_count: i32,
    pub replication_factor: i32,
    pub gateway_version: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BrokerInfo {
    pub node_id: i32,
    pub host: String,
    pub port: i32,
    pub partitions: Vec<PartitionInfo>,
    pub version: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PartitionInfo {
    pub partition_id: i32,
    pub role: String,
    pub health: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StatusResponse {
    pub health: String,
    pub version: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LicenseResponse {
    pub license_type: String,
    pub is_valid_license: bool,
    pub expires_at: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ClockResponse {
    pub epoch_millis: i64,
    pub instant: String,
}
