use std::sync::Arc;
use std::time::{Duration, Instant};
use clap::Parser;
use reqwest::Client;

const SIMPLE_BPMN: &str = r#"<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
                  targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="bench-simple" name="Bench Simple" isExecutable="true">
    <bpmn:startEvent id="start">
      <bpmn:outgoing>flow1</bpmn:outgoing>
    </bpmn:startEvent>
    <bpmn:endEvent id="end">
      <bpmn:incoming>flow1</bpmn:incoming>
    </bpmn:endEvent>
    <bpmn:sequenceFlow id="flow1" sourceRef="start" targetRef="end"/>
  </bpmn:process>
</bpmn:definitions>"#;

#[derive(Parser)]
#[command(name = "reebe-bench", about = "Throughput benchmark for Reebe")]
struct Cli {
    /// Base URL of the Reebe server
    #[arg(long, default_value = "http://localhost:8080")]
    url: String,

    /// Total number of process instances to create
    #[arg(long, default_value_t = 1000)]
    count: usize,

    /// Number of concurrent requests in flight at once
    #[arg(long, default_value_t = 50)]
    concurrency: usize,

    /// Number of warm-up instances before measuring
    #[arg(long, default_value_t = 50)]
    warmup: usize,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let cli = Cli::parse();

    let client = Arc::new(
        Client::builder()
            .timeout(Duration::from_secs(30))
            .build()?,
    );

    // ── Deploy the process ──────────────────────────────────────────────────
    println!("Deploying bench-simple process to {}...", cli.url);
    let form = reqwest::multipart::Form::new().part(
        "resources",
        reqwest::multipart::Part::bytes(SIMPLE_BPMN.as_bytes().to_vec())
            .file_name("bench-simple.bpmn")
            .mime_str("application/xml")?,
    );
    let resp = client
        .post(format!("{}/v2/deployments", cli.url))
        .multipart(form)
        .send()
        .await?;

    if resp.status().is_success() {
        println!("Deployed successfully.");
    } else {
        // If it already exists that's fine — just proceed
        let status = resp.status();
        let body = resp.text().await?;
        if status.as_u16() == 409 || body.contains("duplicate key") || body.contains("already exists") {
            println!("Process already deployed, reusing.");
        } else {
            anyhow::bail!("Deployment failed ({status}): {body}");
        }
    }
    println!();

    let create_url = Arc::new(format!("{}/v2/process-instances", cli.url));
    let body = Arc::new(serde_json::json!({ "bpmnProcessId": "bench-simple" }));

    // ── Warm-up ─────────────────────────────────────────────────────────────
    if cli.warmup > 0 {
        print!("Warming up ({} instances)... ", cli.warmup);
        run_batch(&client, &create_url, &body, cli.warmup, cli.concurrency).await?;
        println!("done.\n");
    }

    // ── Measured run ────────────────────────────────────────────────────────
    println!(
        "Running {} instances with concurrency {}...",
        cli.count, cli.concurrency
    );

    let start = Instant::now();
    let (ok, err) = run_batch(&client, &create_url, &body, cli.count, cli.concurrency).await?;
    let elapsed = start.elapsed();

    let total = ok + err;
    let pi_per_sec = ok as f64 / elapsed.as_secs_f64();

    println!();
    println!("═══════════════════════════════════════");
    println!("  Results");
    println!("───────────────────────────────────────");
    println!("  Total requests : {total}");
    println!("  Successful     : {ok}");
    println!("  Errors         : {err}");
    println!("  Elapsed        : {:.3}s", elapsed.as_secs_f64());
    println!("  Throughput     : {pi_per_sec:.1} PI/s");
    println!("  Avg latency    : {:.2}ms/PI", elapsed.as_millis() as f64 / ok as f64);
    println!("═══════════════════════════════════════");

    Ok(())
}

/// Fire `total` requests with up to `concurrency` in flight at once.
/// Returns (successes, errors).
async fn run_batch(
    client: &Arc<Client>,
    url: &Arc<String>,
    body: &Arc<serde_json::Value>,
    total: usize,
    concurrency: usize,
) -> anyhow::Result<(usize, usize)> {
    use tokio::sync::Semaphore;
    use std::sync::atomic::{AtomicUsize, Ordering};

    let sem = Arc::new(Semaphore::new(concurrency));
    let ok_count = Arc::new(AtomicUsize::new(0));
    let err_count = Arc::new(AtomicUsize::new(0));

    let mut handles = Vec::with_capacity(total);

    for _ in 0..total {
        let permit = sem.clone().acquire_owned().await?;
        let client = client.clone();
        let url = url.clone();
        let body = body.clone();
        let ok = ok_count.clone();
        let err = err_count.clone();

        handles.push(tokio::spawn(async move {
            let _permit = permit;
            match client.post(url.as_str()).json(body.as_ref()).send().await {
                Ok(r) if r.status().is_success() => { ok.fetch_add(1, Ordering::Relaxed); }
                _ => { err.fetch_add(1, Ordering::Relaxed); }
            }
        }));
    }

    for h in handles {
        let _ = h.await;
    }

    Ok((ok_count.load(Ordering::Relaxed), err_count.load(Ordering::Relaxed)))
}
