/**
 * Wasm adapter — routes studio API calls to the in-browser WasmEngine.
 *
 * The WasmEngine snapshot uses snake_case Rust field names. This adapter
 * translates them to the camelCase Camunda 8 REST API shape expected by the
 * studio's TanStack Query hooks.
 */

import type { WasmEngine } from "@bpmnkit/reebe-wasm"
import type {
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
}

interface WasmVariable {
	name: string
	value: unknown
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

interface WasmSnapshot {
	processInstances: WasmProcessInstance[]
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

// ── Engine singleton ─────────────────────────────────────────────────────────

let engine: WasmEngine | null = null

/** Locally-tracked process definitions (not in engine snapshot). */
const localDefs = new Map<
	string,
	{ key: string; bpmnProcessId: string; version: number; xml: string; deployedAt: string }
>()

export async function initWasmEngine(): Promise<void> {
	if (engine) {
		log("Engine already initialised — skipping")
		return
	}
	log("Initialising WasmEngine…")
	const mod = await import("@bpmnkit/reebe-wasm")
	await mod.default()
	engine = new mod.WasmEngine()
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
		const xml = await extractXmlFromForm(form)
		log(
			`   deploy: xml length=${xml.length}, first 80 chars: ${xml.slice(0, 80).replace(/\n/g, " ")}`,
		)
		let result: DeployResponse
		try {
			result = eng.deploy(xml) as DeployResponse
		} catch (err) {
			logError("   deploy failed:", err)
			throw new Error(String(err))
		}
		log("   deploy result:", JSON.stringify(result))
		const now = new Date().toISOString()
		for (const dep of result.deployments ?? []) {
			log(
				`   storing localDef key=${dep.processDefinitionKey} bpmnProcessId=${dep.bpmnProcessId} v${dep.version}`,
			)
			localDefs.set(dep.processDefinitionKey, {
				key: dep.processDefinitionKey,
				bpmnProcessId: dep.bpmnProcessId,
				version: dep.version,
				xml,
				deployedAt: now,
			})
		}
		log(`   localDefs now has ${localDefs.size} entries`)
		const response = {
			deploymentKey: result.deploymentKey,
			processes: (result.deployments ?? []).map((d) => ({
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

async function extractXmlFromForm(form: FormData | undefined): Promise<string> {
	if (!form) throw new Error("Deploy requires FormData")
	const file = form.get("resources")
	if (typeof file === "string") return file
	if (file != null) return (file as Blob).text()
	throw new Error("Could not extract BPMN XML from FormData")
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
