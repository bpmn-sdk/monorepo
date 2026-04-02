/**
 * Wasm adapter — routes studio API calls to the in-browser WasmEngine.
 *
 * The WasmEngine snapshot uses snake_case Rust field names. This adapter
 * translates them to the camelCase Camunda 8 REST API shape expected by the
 * studio's TanStack Query hooks.
 */

import { resolveSecretString } from "@bpmnkit/engine"
import type { WasmEngine } from "@bpmnkit/reebe-wasm"
import { proxySecretResolver } from "../stores/secrets.js"
import { queryClient } from "./queryClient.js"
import type {
	ElementInstance,
	Incident,
	Job,
	PageResponse,
	ProcessDefinition,
	ProcessInstance,
	Variable,
} from "./types.js"

// ── Snapshot types (mirrors the Rust structs, serialised as snake_case) ───────

interface WasmProcessInstance {
	key: number
	process_definition_key: number
	bpmn_process_id: string
	version: number
	state: string
	start_date: string
	end_date: string | null
}

interface WasmJob {
	key: number
	job_type: string
	state: string
	process_instance_key: number
	element_instance_key: number
	element_id: string
	custom_headers: Record<string, unknown>
}

interface WasmVariable {
	name: string
	value: unknown
	scope_key: number
	process_instance_key: number
}

interface WasmIncident {
	key: number
	process_instance_key: number
	process_definition_key: number
	element_id: string
	error_type: string
	error_message: string | null
	state: string
	created_at: string
}

interface WasmElementInstance {
	key: number
	process_instance_key: number
	process_definition_key: number
	element_id: string
	element_type: string
	state: string
}

interface WasmSnapshot {
	processInstances: WasmProcessInstance[]
	elementInstances: WasmElementInstance[]
	jobs: WasmJob[]
	variables: WasmVariable[]
	incidents: WasmIncident[]
}

interface DeployResponse {
	deploymentKey: string
	deployments: Array<{
		processDefinitionKey: string
		bpmnProcessId: string
		version: number
	}>
}

// ── Logging ──────────────────────────────────────────────────────────────────

const TAG = "[reebe-wasm]"

function log(...args: unknown[]) {
	console.log(TAG, ...args)
}

function logError(...args: unknown[]) {
	console.error(TAG, ...args)
}

// ── Job result tracking ───────────────────────────────────────────────────────

export interface JobResult {
	jobKey: number
	elementId: string
	jobType: string
	kind: "simulated" | "rest-ok" | "rest-error"
	status?: number
	error?: string
	processInstanceKey: number
}

const jobResults = new Map<number, JobResult>()

export function getJobResults(processInstanceKey?: number): JobResult[] {
	const all = [...jobResults.values()]
	return processInstanceKey != null
		? all.filter((r) => r.processInstanceKey === processInstanceKey)
		: all
}

// ── Engine singleton ─────────────────────────────────────────────────────────

let engine: WasmEngine | null = null
let timerPollId: ReturnType<typeof setInterval> | null = null

/** Locally-tracked process definitions (not in engine snapshot). */
const localDefs = new Map<
	string,
	{ key: string; bpmnProcessId: string; version: number; xml: string; deployedAt: string }
>()

const HTTP_JOB_TYPE = "io.camunda:http-json:1"
const PROXY_HTTP_URL = "http://localhost:3033/http-request"

// ── Simulation mode ───────────────────────────────────────────────────────────
// When false (default), service tasks that cannot be handled create an incident.
// When true, they are auto-completed with empty/simulated data.
let simulationMode = false

export function getSimulationMode(): boolean {
	return simulationMode
}

export function setSimulationMode(enabled: boolean): void {
	simulationMode = enabled
}

/** Jobs currently being handled to avoid double-activation. */
const inFlight = new Set<number>()

async function pollJobs(): Promise<void> {
	if (!engine) return
	const eng = engine
	const snap = eng.snapshot() as WasmSnapshot
	const activatable = snap.jobs.filter((j) => j.state === "ACTIVATABLE")
	for (const job of activatable) {
		if (inFlight.has(job.key)) continue
		inFlight.add(job.key)
		void handleJob(eng, job, snap.variables).finally(() => inFlight.delete(job.key))
	}
}

async function handleJob(eng: WasmEngine, job: WasmJob, allVars: WasmVariable[]): Promise<void> {
	try {
		eng.activate_job(job.key, "reebe-wasm-worker", 30_000)
	} catch {
		return
	}
	if (job.job_type === HTTP_JOB_TYPE) {
		await handleHttpJob(eng, job, allVars)
	} else if (simulationMode) {
		try {
			eng.complete_job(job.key, "{}")
			jobResults.set(job.key, {
				jobKey: job.key,
				elementId: job.element_id,
				jobType: job.job_type,
				kind: "simulated",
				processInstanceKey: job.process_instance_key,
			})
		} catch {
			// ignore — job may have been completed elsewhere
		}
	} else {
		try {
			eng.fail_job(
				job.key,
				0,
				`Service task "${job.job_type}" has no handler. Enable Simulation Mode to auto-complete.`,
			)
		} catch {
			/* ignore */
		}
		jobResults.set(job.key, {
			jobKey: job.key,
			elementId: job.element_id,
			jobType: job.job_type,
			kind: "rest-error",
			error: `No handler for job type "${job.job_type}"`,
			processInstanceKey: job.process_instance_key,
		})
	}
}

/** Resolve `{{secrets.NAME}}` placeholders in a string using the proxy resolver. */
async function applySecrets(value: string): Promise<string> {
	return resolveSecretString(value, proxySecretResolver)
}

async function handleHttpJob(
	eng: WasmEngine,
	job: WasmJob,
	allVars: WasmVariable[],
): Promise<void> {
	// Build variable map: element-scoped vars first, then process-scoped as fallback
	const varMap: Record<string, unknown> = {}
	for (const v of allVars.filter((v) => v.scope_key === job.process_instance_key)) {
		varMap[v.name] = v.value
	}
	for (const v of allVars.filter((v) => v.scope_key === job.element_instance_key)) {
		varMap[v.name] = v.value
	}

	const rawUrl = typeof varMap.url === "string" ? varMap.url : undefined
	const url = rawUrl ? await applySecrets(rawUrl) : undefined
	const method = typeof varMap.method === "string" ? varMap.method.toUpperCase() : "GET"
	const reqBody =
		method !== "GET" && method !== "HEAD" && varMap.body !== undefined
			? JSON.stringify(varMap.body)
			: undefined

	const headers: Record<string, string> = { "content-type": "application/json" }
	const headersRaw = varMap.headers
	if (headersRaw && typeof headersRaw === "object") {
		for (const [k, v] of Object.entries(headersRaw as Record<string, unknown>)) {
			if (typeof v === "string") headers[k] = await applySecrets(v)
		}
	}
	const auth = varMap.authentication
	if (auth && typeof auth === "object") {
		const a = auth as Record<string, unknown>
		if (a.type === "bearer" && typeof a.token === "string") {
			const token = await applySecrets(a.token)
			headers.authorization = `Bearer ${token}`
		} else if (
			a.type === "basic" &&
			typeof a.username === "string" &&
			typeof a.password === "string"
		) {
			headers.authorization = `Basic ${btoa(`${a.username}:${a.password}`)}`
		}
	}
	for (const [k, v] of Object.entries(job.custom_headers ?? {})) {
		if (typeof v === "string") headers[k] = await applySecrets(v)
	}

	if (!url) {
		if (simulationMode) {
			try {
				eng.complete_job(
					job.key,
					JSON.stringify({ response: { status: 200, body: {}, headers: {} } }),
				)
			} catch {
				/* ignore */
			}
			jobResults.set(job.key, {
				jobKey: job.key,
				elementId: job.element_id,
				jobType: job.job_type,
				kind: "simulated",
				processInstanceKey: job.process_instance_key,
			})
		} else {
			try {
				eng.fail_job(
					job.key,
					0,
					"REST connector has no URL configured. Enable Simulation Mode to auto-complete.",
				)
			} catch {
				/* ignore */
			}
			jobResults.set(job.key, {
				jobKey: job.key,
				elementId: job.element_id,
				jobType: job.job_type,
				kind: "rest-error",
				error: "No URL configured",
				processInstanceKey: job.process_instance_key,
			})
		}
		return
	}

	type HttpResponse = { status: number; body: unknown; headers: Record<string, string> }
	let response: HttpResponse | null = null
	let fetchError: string | null = null

	// Tier 1: direct browser fetch
	try {
		const res = await fetch(url, { method, headers, body: reqBody })
		const text = await res.text()
		let body: unknown = text
		try {
			body = JSON.parse(text)
		} catch {
			/* use text */
		}
		response = { status: res.status, body, headers: Object.fromEntries(res.headers.entries()) }
	} catch (err) {
		fetchError = String(err)
		log(`HTTP job ${job.key}: direct fetch failed (${fetchError}), trying proxy…`)
		// Tier 2: CORS-bypass proxy
		try {
			const proxyRes = await fetch(PROXY_HTTP_URL, {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ url, method, headers, body: reqBody }),
			})
			const text = await proxyRes.text()
			let body: unknown = text
			try {
				body = JSON.parse(text)
			} catch {
				/* use text */
			}
			response = {
				status: proxyRes.status,
				body,
				headers: Object.fromEntries(proxyRes.headers.entries()),
			}
			fetchError = null
		} catch (proxyErr) {
			log(`HTTP job ${job.key}: proxy also failed: ${String(proxyErr)}`)
		}
	}

	if (response) {
		try {
			eng.complete_job(job.key, JSON.stringify({ response }))
			jobResults.set(job.key, {
				jobKey: job.key,
				elementId: job.element_id,
				jobType: job.job_type,
				kind: response.status < 400 ? "rest-ok" : "rest-error",
				status: response.status,
				processInstanceKey: job.process_instance_key,
			})
		} catch (e) {
			logError(`HTTP job ${job.key}: complete_job failed:`, e)
		}
	} else if (simulationMode) {
		// Tier 3 (simulation on): complete with empty simulated response
		try {
			eng.complete_job(job.key, JSON.stringify({ response: { status: 0, body: {}, headers: {} } }))
		} catch {
			/* ignore */
		}
		jobResults.set(job.key, {
			jobKey: job.key,
			elementId: job.element_id,
			jobType: job.job_type,
			kind: "rest-error",
			error: fetchError ?? "Proxy unavailable",
			processInstanceKey: job.process_instance_key,
		})
	} else {
		// Tier 3 (simulation off): fail the job to create an incident
		try {
			eng.fail_job(
				job.key,
				0,
				fetchError ?? "HTTP request failed. Enable Simulation Mode to auto-complete.",
			)
		} catch {
			/* ignore */
		}
		jobResults.set(job.key, {
			jobKey: job.key,
			elementId: job.element_id,
			jobType: job.job_type,
			kind: "rest-error",
			error: fetchError ?? "HTTP request failed",
			processInstanceKey: job.process_instance_key,
		})
	}
}

/** Tick the engine (timers + jobs) and refresh active queries. */
async function tickEngineAsync(): Promise<void> {
	if (!engine) return
	try {
		engine.tick()
	} catch {
		// Ignore tick errors — engine may not be ready
	}
	await pollJobs()
	void queryClient.invalidateQueries({ refetchType: "active" })
}

function tickEngine(): void {
	void tickEngineAsync()
}

export async function initWasmEngine(): Promise<void> {
	if (engine) {
		log("Engine already initialised — skipping")
		return
	}
	log("Initialising WasmEngine…")
	const mod = await import("@bpmnkit/reebe-wasm")
	await mod.default()
	engine = new mod.WasmEngine()
	// Poll for due timers every 2 seconds so intermediate timer events fire automatically
	if (timerPollId === null) {
		timerPollId = setInterval(tickEngine, 2000)
	}
	log("WasmEngine ready")
}

function getEngine(): WasmEngine {
	if (!engine) throw new Error("WasmEngine not initialised")
	return engine
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function pageOf<T>(items: T[], totalItems?: number): PageResponse<T> {
	return { items, page: { totalItems: totalItems ?? items.length } }
}

function mapInstance(i: WasmProcessInstance): ProcessInstance {
	return {
		processInstanceKey: String(i.key),
		processDefinitionId: i.bpmn_process_id,
		processDefinitionKey: String(i.process_definition_key),
		state: i.state as ProcessInstance["state"],
		startDate: i.start_date,
		endDate: i.end_date ?? undefined,
	}
}

function mapJob(j: WasmJob): Job {
	return {
		jobKey: String(j.key),
		type: j.job_type,
		state: j.state,
		processInstanceKey: String(j.process_instance_key),
	}
}

function mapVariable(v: WasmVariable): Variable {
	return { name: v.name, value: v.value }
}

function mapIncident(inc: WasmIncident, instancesById: Map<string, WasmProcessInstance>): Incident {
	const pi = instancesById.get(String(inc.process_instance_key))
	return {
		incidentKey: String(inc.key),
		processDefinitionId: pi?.bpmn_process_id ?? String(inc.process_definition_key),
		processDefinitionKey: String(inc.process_definition_key),
		processInstanceKey: String(inc.process_instance_key),
		elementId: inc.element_id,
		errorType: inc.error_type,
		errorMessage: inc.error_message ?? "",
		creationTime: inc.created_at,
		state: inc.state,
	}
}

function mapElementInstance(ei: WasmElementInstance): ElementInstance {
	return {
		elementInstanceKey: String(ei.key),
		processInstanceKey: String(ei.process_instance_key),
		processDefinitionKey: String(ei.process_definition_key),
		elementId: ei.element_id,
		elementType: ei.element_type,
		state: ei.state,
	}
}

// ── Route handler ─────────────────────────────────────────────────────────────

/**
 * Handle a studio API call against the WasmEngine.
 * Returns the parsed response body, same shape as the real proxy.
 * Throws on unknown routes (caller falls back to HTTP proxy).
 */
export async function wasmRoute(
	method: string,
	path: string,
	body?: unknown,
	form?: FormData,
): Promise<unknown> {
	log(`→ ${method} ${path}`)
	const eng = getEngine()

	// ── Deploy ────────────────────────────────────────────────────────────────
	if (method === "POST" && path === "/api/deployments") {
		const resources = await extractAllXmlsFromForm(form)
		log(`   deploy: ${resources.length} resource(s)`)

		// Deploy all resources (BPMN + companion DMNs); keep only the BPMN result.
		let bpmnResult: DeployResponse = { deploymentKey: "0", deployments: [] }
		let bpmnXml = ""
		for (const xml of resources) {
			log(
				`   deploying resource: length=${xml.length}, first 80: ${xml.slice(0, 80).replace(/\n/g, " ")}`,
			)
			let depResult: DeployResponse
			try {
				depResult = eng.deploy(xml) as DeployResponse
			} catch (err) {
				logError("   deploy failed:", err)
				throw new Error(String(err))
			}
			log("   deploy result:", JSON.stringify(depResult))
			// Only capture results from BPMN deploys (they carry process definitions).
			if ((depResult.deployments?.length ?? 0) > 0) {
				bpmnResult = depResult
				bpmnXml = xml
			}
		}

		const now = new Date().toISOString()
		for (const dep of bpmnResult.deployments ?? []) {
			log(
				`   storing localDef key=${dep.processDefinitionKey} bpmnProcessId=${dep.bpmnProcessId} v${dep.version}`,
			)
			localDefs.set(dep.processDefinitionKey, {
				key: dep.processDefinitionKey,
				bpmnProcessId: dep.bpmnProcessId,
				version: dep.version,
				xml: bpmnXml,
				deployedAt: now,
			})
		}
		log(`   localDefs now has ${localDefs.size} entries`)
		const response = {
			deploymentKey: bpmnResult.deploymentKey,
			processes: (bpmnResult.deployments ?? []).map((d) => ({
				processDefinitionKey: d.processDefinitionKey,
				bpmnProcessId: d.bpmnProcessId,
				version: d.version,
			})),
		}
		log(`← ${method} ${path}`, JSON.stringify(response))
		return response
	}

	const snap = () => eng.snapshot() as WasmSnapshot

	// ── Process definitions ───────────────────────────────────────────────────
	if (method === "POST" && path === "/api/process-definitions/search") {
		const filter = (body as { filter?: Record<string, unknown> })?.filter ?? {}
		let defs = buildDefinitions()
		log(
			`   definitions search filter=${JSON.stringify(filter)}, total before filter=${defs.length}`,
		)
		if (filter.bpmnProcessId) defs = defs.filter((d) => d.bpmnProcessId === filter.bpmnProcessId)
		log(`← ${method} ${path} → ${defs.length} definitions`)
		return pageOf(defs, defs.length)
	}

	{
		const m = path.match(/^\/api\/process-definitions\/([^/]+)\/xml$/)
		if (m && method === "GET") {
			const defKey = m[1] ?? ""
			const def = localDefs.get(defKey)
			if (!def) {
				logError(`   definition xml not found: key=${defKey}`)
				throw new Error(`Process definition ${defKey} not found`)
			}
			log(`← ${method} ${path} → xml length=${def.xml.length}`)
			return def.xml
		}
	}

	{
		const m = path.match(/^\/api\/process-definitions\/([^/]+)$/)
		if (m && method === "GET") {
			const defKey = m[1] ?? ""
			const def = localDefs.get(defKey)
			if (!def) {
				logError(`   definition not found: key=${defKey}`)
				throw new Error(`Process definition ${defKey} not found`)
			}
			log(`← ${method} ${path} → bpmnProcessId=${def.bpmnProcessId}`)
			return toApiDefinition(def)
		}
	}

	// ── Create process instance ───────────────────────────────────────────────
	if (method === "POST" && path === "/api/process-instances") {
		const b = body as {
			bpmnProcessId?: string
			processDefinitionKey?: string
			variables?: Record<string, unknown>
		}
		const processId = b.bpmnProcessId ?? localDefs.get(b.processDefinitionKey ?? "")?.bpmnProcessId
		log(`   create instance processId=${processId}, vars=${JSON.stringify(b.variables ?? {})}`)
		if (!processId) throw new Error("bpmnProcessId or processDefinitionKey required")
		let result: { processInstanceKey?: string }
		try {
			result = eng.create_process_instance(processId, JSON.stringify(b.variables ?? {})) as {
				processInstanceKey?: string
			}
		} catch (err) {
			logError("   create_process_instance failed:", err)
			throw new Error(String(err))
		}
		log(`← ${method} ${path} → processInstanceKey=${result?.processInstanceKey}`)
		return { processInstanceKey: result?.processInstanceKey ?? "0" }
	}

	// ── Process instances ─────────────────────────────────────────────────────
	if (method === "POST" && path === "/api/process-instances/search") {
		const filter = (body as { filter?: Record<string, unknown> })?.filter ?? {}
		let items = snap().processInstances.map(mapInstance)
		if (filter.state) items = items.filter((i) => i.state === filter.state)
		if (filter.bpmnProcessId)
			items = items.filter((i) => i.processDefinitionId === filter.bpmnProcessId)
		log(`← ${method} ${path} → ${items.length} instances`)
		return pageOf(items, items.length)
	}

	{
		const m = path.match(/^\/api\/process-instances\/([^/]+)$/)
		if (m && method === "GET") {
			const instance = snap()
				.processInstances.map(mapInstance)
				.find((i) => i.processInstanceKey === m[1])
			if (!instance) {
				logError(`   instance not found: key=${m[1]}`)
				throw new Error(`Process instance ${m[1]} not found`)
			}
			log(`← ${method} ${path} → state=${instance.state}`)
			return instance
		}
		if (m && method === "DELETE") {
			log(`   cancel_process_instance key=${m[1]}`)
			eng.cancel_process_instance(Number(m[1]))
			log(`← ${method} ${path} → cancelled`)
			return null
		}
	}

	// ── Variables ─────────────────────────────────────────────────────────────
	if (method === "POST" && path === "/api/variables/search") {
		const filter = (body as { filter?: Record<string, unknown> })?.filter ?? {}
		const piKey = filter.processInstanceKey as string | undefined
		let vars = snap().variables.map(mapVariable)
		if (piKey) {
			const piKeyNum = Number(piKey)
			vars = snap()
				.variables.filter((v) => v.process_instance_key === piKeyNum)
				.map(mapVariable)
		}
		log(`← ${method} ${path} → ${vars.length} variables`)
		return pageOf(vars, vars.length)
	}

	// ── Element instances ─────────────────────────────────────────────────────
	if (method === "POST" && path === "/api/element-instances/search") {
		const filter = (body as { filter?: Record<string, unknown> })?.filter ?? {}
		const piKey = filter.processInstanceKey as string | undefined
		let items = snap().elementInstances.map(mapElementInstance)
		if (piKey) {
			const piKeyNum = Number(piKey)
			items = snap()
				.elementInstances.filter((ei) => ei.process_instance_key === piKeyNum)
				.map(mapElementInstance)
		}
		log(`← ${method} ${path} → ${items.length} element instances`)
		return pageOf(items, items.length)
	}

	// ── Incidents ─────────────────────────────────────────────────────────────
	if (method === "POST" && path === "/api/incidents/search") {
		const filter = (body as { filter?: Record<string, unknown> })?.filter ?? {}
		const s = snap()
		const instancesById = new Map(s.processInstances.map((i) => [String(i.key), i]))
		let items = s.incidents.map((inc) => mapIncident(inc, instancesById))
		if (filter.state) items = items.filter((i) => i.state === filter.state)
		if (filter.processInstanceKey)
			items = items.filter((i) => i.processInstanceKey === String(filter.processInstanceKey))
		log(`← ${method} ${path} → ${items.length} incidents`)
		return pageOf(items, items.length)
	}

	{
		const m = path.match(/^\/api\/incidents\/([^/]+)\/resolution$/)
		if (m && method === "POST") {
			log(`← ${method} ${path} → no-op`)
			// No direct resolve via WasmEngine — return success silently
			return null
		}
	}

	{
		const m = path.match(/^\/api\/incidents\/([^/]+)$/)
		if (m && method === "GET") {
			const s = snap()
			const instancesById = new Map(s.processInstances.map((i) => [String(i.key), i]))
			const incident = s.incidents
				.map((inc) => mapIncident(inc, instancesById))
				.find((i) => i.incidentKey === m[1])
			if (!incident) {
				logError(`   incident not found: key=${m[1]}`)
				throw new Error(`Incident ${m[1]} not found`)
			}
			log(`← ${method} ${path} → found`)
			return incident
		}
	}

	// ── Jobs ──────────────────────────────────────────────────────────────────
	if (method === "POST" && path === "/api/jobs/search") {
		const filter = (body as { filter?: Record<string, unknown> })?.filter ?? {}
		let items = snap().jobs.map(mapJob)
		if (filter.state) items = items.filter((j) => j.state === filter.state)
		if (filter.type) items = items.filter((j) => j.type === filter.type)
		log(`← ${method} ${path} → ${items.length} jobs`)
		return pageOf(items, items.length)
	}

	// ── User tasks (no-op — not in wasm snapshot) ─────────────────────────────
	if (method === "POST" && path === "/api/user-tasks/search") {
		return pageOf([], 0)
	}
	if (path.startsWith("/api/user-tasks/")) {
		return null
	}

	// ── Decisions (no-op) ─────────────────────────────────────────────────────
	if (method === "POST" && path === "/api/decision-definitions/search") {
		return pageOf([], 0)
	}

	logError(`Unhandled route: ${method} ${path}`)
	throw new Error(`wasmRoute: unhandled ${method} ${path}`)
}

// ── Internal helpers ──────────────────────────────────────────────────────────

async function extractAllXmlsFromForm(form: FormData | undefined): Promise<string[]> {
	if (!form) throw new Error("Deploy requires FormData")
	const entries = form.getAll("resources")
	if (entries.length === 0) throw new Error("Deploy requires at least one resource")
	return Promise.all(
		entries.map((e) => (typeof e === "string" ? Promise.resolve(e) : (e as Blob).text())),
	)
}

function buildDefinitions(): ProcessDefinition[] {
	return [...localDefs.values()].map(toApiDefinition)
}

function toApiDefinition(d: {
	key: string
	bpmnProcessId: string
	version: number
	deployedAt?: string
}): ProcessDefinition {
	return {
		processDefinitionKey: d.key,
		name: d.bpmnProcessId,
		processDefinitionId: d.bpmnProcessId,
		bpmnProcessId: d.bpmnProcessId,
		version: d.version,
		deploymentTime: d.deployedAt,
	}
}
