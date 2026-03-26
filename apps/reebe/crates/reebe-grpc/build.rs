fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Use vendored protoc if PROTOC is not set
    if std::env::var("PROTOC").is_err() {
        let protoc = protoc_bin_vendored::protoc_bin_path().unwrap();
        std::env::set_var("PROTOC", protoc);
    }
    tonic_build::configure()
        .build_server(true)
        .build_client(false)
        .compile_protos(&["proto/gateway.proto"], &["proto"])?;
    Ok(())
}
