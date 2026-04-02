/**
 * Worker daemon — polls a local reebe instance for BPMN service task jobs and
 * dispatches them to built-in handlers (CLI, LLM, FS, JS).
 *
 * Activated on proxy startup; respects BPMNKIT_WORKERS=false to opt out.
 */
import { getActiveProfile, getAuthHeader } from "@bpmnkit/profiles"
import { onJobComplete, onJobFail, onJobStart } from "./routes/run-history.js"
import * as cliWorker from "./workers/cli.js"
import * as emailWorker from "./workers/email.js"
import * as fsWorker from "./workers/fs.js"
import * as httpWorker from "./workers/http.js"
import * as jsWorker from "./workers/js.js"
import * as llmWorker from "./workers/llm.js"

// ── Types ─────────────────────────────────────────────────────────────────────

export interface WorkerJob {
	jobKey: string
	type: string
	processInstanceKey: string
	elementInstanceKey: string
	variables: Record<string, unknown>
	customHeaders: Record<string, string>
}

type WorkerHandler = (job: WorkerJob) => Promise<Record<string, unknown>>

// ── Template variable interpolation ──────────────────────────────────────────

const VAR_RE = /\{\{([\w.]+)\}\}/g

/**
 * Replace `{{varName}}` and `{{secrets.NAME}}` placeholders in a string.
 * Secrets are read from `process.env` (proxy runs in Node.js).
 */
export function interpolate(template: string, vars: Record<string, unknown>): string {
	return template.replace(VAR_RE, (match, key: string) => {
		if (key.startsWith("secrets.")) {
			const secretName = key.slice("secrets.".length)
			return process.env[secretName] ?? match
		}
		const val = vars[key]
		return val !== undefined ? String(val) : match
	})
}

// ── Registry ──────────────────────────────────────────────────────────────────

const registry = new Map<string, WorkerHandler>([
	[cliWorker.JOB_TYPE, cliWorker.handle],
	[llmWorker.JOB_TYPE, llmWorker.handle],
	[fsWorker.JOB_TYPE_READ, fsWorker.handleRead],
	[fsWorker.JOB_TYPE_WRITE, fsWorker.handleWrite],
	[fsWorker.JOB_TYPE_APPEND, fsWorker.handleAppend],
	[fsWorker.JOB_TYPE_LIST, fsWorker.handleList],
	[jsWorker.JOB_TYPE, jsWorker.handle],
	[httpWorker.JOB_TYPE, httpWorker.handle],
	[emailWorker.JOB_TYPE_FETCH, emailWorker.handleFetch],
	[emailWorker.JOB_TYPE_SEND, emailWorker.handleSend],
])

// ── Daemon state (exported for /status) ──────────────────────────────────────

export const workerState = {
	active: false,
	pollCount: 0,
	jobTypes: [...registry.keys()],
	lastError: null as string | null,
}

// ── HTTP helpers ──────────────────────────────────────────────────────────────

interface ReebJobResponse {
	jobs: Array<{
		jobKey: string
		type: string
		processInstanceKey: string
		elementInstanceKey: string
		variables: Record<string, unknown>
		customHeaders: Record<string, string>
	}>
}

async function activateJobs(
	baseUrl: string,
	authHeader: string,
	type: string,
): Promise<WorkerJob[]> {
	const res = await fetch(`${baseUrl}/v2/jobs/activation`, {
		method: "POST",
		headers: { authorization: authHeader, "content-type": "application/json" },
		body: JSON.stringify({
			type,
			timeout: 30_000,
			maxJobsToActivate: 5,
			worker: "bpmnkit-worker",
		}),
	})
	if (!res.ok) return []
	const data = (await res.json()) as ReebJobResponse
	return (data.jobs ?? []).map((j) => ({
		jobKey: j.jobKey,
		type: j.type,
		processInstanceKey: j.processInstanceKey,
		elementInstanceKey: j.elementInstanceKey,
		variables: j.variables ?? {},
		customHeaders: j.customHeaders ?? {},
	}))
}

async function completeJob(
	baseUrl: string,
	authHeader: string,
	jobKey: string,
	variables: Record<string, unknown>,
): Promise<void> {
	await fetch(`${baseUrl}/v2/jobs/${jobKey}/completion`, {
		method: "POST",
		headers: { authorization: authHeader, "content-type": "application/json" },
		body: JSON.stringify({ variables }),
	})
}

async function failJob(
	baseUrl: string,
	authHeader: string,
	jobKey: string,
	message: string,
	retries: number,
): Promise<void> {
	await fetch(`${baseUrl}/v2/jobs/${jobKey}/failure`, {
		method: "POST",
		headers: { authorization: authHeader, "content-type": "application/json" },
		body: JSON.stringify({ retries, errorMessage: message }),
	})
}

// ── Dispatch ──────────────────────────────────────────────────────────────────

async function dispatchJob(
	baseUrl: string,
	authHeader: string,
	job: WorkerJob,
	handler: WorkerHandler,
): Promise<void> {
	console.log(`[worker] job ${job.jobKey} type=${job.type} pi=${job.processInstanceKey}`)
	onJobStart(job)
	const startMs = Date.now()
	try {
		const outputs = await handler(job)
		const durationMs = Date.now() - startMs
		await completeJob(baseUrl, authHeader, job.jobKey, outputs)
		onJobComplete(job, outputs, durationMs)
		console.log(`[worker] job ${job.jobKey} completed in ${durationMs}ms`)
	} catch (err) {
		const durationMs = Date.now() - startMs
		const message = err instanceof Error ? err.message : String(err)
		console.error(`[worker] job ${job.jobKey} failed: ${message}`)
		await failJob(baseUrl, authHeader, job.jobKey, message, 0)
		onJobFail(job, message, durationMs)
	}
}

async function pollOnce(baseUrl: string, authHeader: string): Promise<void> {
	workerState.pollCount++
	const types = [...registry.keys()]
	await Promise.all(
		types.map(async (type) => {
			const handler = registry.get(type)
			if (!handler) return
			let jobs: WorkerJob[]
			try {
				jobs = await activateJobs(baseUrl, authHeader, type)
			} catch {
				return // reebe unreachable, skip
			}
			await Promise.all(jobs.map((job) => dispatchJob(baseUrl, authHeader, job, handler)))
		}),
	)
}

// ── Startup ───────────────────────────────────────────────────────────────────

const POLL_INTERVAL_MS = 1_000

export function startWorkerDaemon(): void {
	if (process.env.BPMNKIT_WORKERS === "false") {
		console.log("[worker] disabled via BPMNKIT_WORKERS=false")
		return
	}

	// Run the poll loop in the background, refreshing profile on each cycle
	workerState.active = true
	console.log(`[worker] daemon starting, polling types: ${[...registry.keys()].join(", ")}`)

	let running = false
	setInterval(async () => {
		if (running) return // don't overlap
		running = true
		try {
			const profile = getActiveProfile()
			if (!profile?.config.baseUrl) return

			// Skip non-reebe profiles (wasm, modeler-only)
			const baseUrl = profile.config.baseUrl.replace(/\/$/, "")
			if (!baseUrl.startsWith("http")) return

			let authHeader = ""
			try {
				authHeader = await getAuthHeader(profile.config)
			} catch {
				// Unauthenticated reebe — proceed without auth
			}

			await pollOnce(baseUrl, authHeader)
			workerState.lastError = null
		} catch (err) {
			workerState.lastError = err instanceof Error ? err.message : String(err)
		} finally {
			running = false
		}
	}, POLL_INTERVAL_MS)
}
