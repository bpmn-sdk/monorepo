use bpmn_proxy::bridge::CoreBridge;
use bpmn_proxy::mcp_server;

fn get_arg(flag: &str) -> Option<String> {
    let args: Vec<String> = std::env::args().collect();
    let idx = args.iter().position(|a| a == flag)?;
    args.get(idx + 1).cloned()
}

fn main() {
    let input_file = get_arg("--input");
    let output_file = get_arg("--output");

    let bridge = CoreBridge::new();

    // Initialize MCP state from optional BPMN XML file
    let xml = input_file.as_deref().and_then(|path| {
        std::fs::read_to_string(path).ok()
    });
    if let Err(e) = bridge.mcp_init_sync(xml) {
        eprintln!("[bpmn-mcp] init failed: {e}");
        std::process::exit(1);
    }

    mcp_server::run(&bridge, output_file.as_deref());
}
