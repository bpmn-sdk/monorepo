//! Zeebe-compatible gRPC gateway for the Reebe workflow engine.
//!
//! Listens on port 26500 (the standard Zeebe gRPC port) and implements
//! the `gateway_protocol.Gateway` service using the same `EngineHandle`
//! and DB pool as the REST API.

pub mod service;

pub use service::{GatewayService, GatewayState};

use std::net::SocketAddr;
use tonic::transport::Server;

/// Start the gRPC server on the given address.
pub async fn serve(state: GatewayState, addr: SocketAddr) -> Result<(), tonic::transport::Error> {
    use crate::service::proto::gateway_protocol::gateway_server::GatewayServer;
    Server::builder()
        .add_service(GatewayServer::new(GatewayService::new(state)))
        .serve(addr)
        .await
}
