/**
 * Scenario runner for the in-browser WasmEngine.
 *
 * Creates a fresh WasmEngine per scenario for clean isolation, deploys the
 * current BPMN XML (and all referenced DMN/BPMN resources recursively), drives
 * jobs to completion using mock outputs from the scenario definition, then
 * asserts expectations.
 */

import type { ScenarioLike, ScenarioResultLike } from "@bpmnkit/plugins/process-runner"

// ── Snapshot types (mirrors wasm-adapter shape) ───────────────────────────────

interface WasmProcessInstance {
	key: number
	bpmn_process_id: string
	state: string
}

interface WasmJob {
	key: number
	job_type: string
	state: string
	process_instance_key: number
	element_id: string
}

interface WasmElementInstance {
	key: number
	process_instance_key: number
	element_id: string
	state: string
}

interface WasmVariable {
	name: string
	value: unknown
	process_instance_key: number
}

interface WasmIncident {
	process_instance_key: number
	element_id: string
	error_type: string
	error_message: string | null
}

interface WasmSnapshot {
	processInstances: WasmProcessInstance[]
	elementInstances: WasmElementInstance[]
	jobs: WasmJob[]
	variables: WasmVariable[]
	incidents: WasmIncident[]
}

interface DeployResponse {
	deployments: Array<{ bpmnProcessId: string }>
}

interface WasmEngineInstance {
	deploy(xml: string): unknown
	create_process_instance(processId: string, variables: string): void
	activate_job(key: number, worker: string, timeout: number): void
	complete_job(key: number, variables: string): void
	fail_job(key: number, retries: number, message: string): void
	snapshot(): unknown
	free(): void
}

// ── Recursive dependency deployment ──────────────────────────────────────────

/**
 * Deploys all referenced DMN decisions and called-element BPMNs found in `xml`
 * into `engine`, recursively following calledElement references. Tracks already-
 * deployed IDs in `deployed` to prevent cycles and duplicate deployments.
 */
function deployDependencies(
	xml: string,
	engine: WasmEngineInstance,
	getDecisionDmn: ((id: string) => string | null) | undefined,
	getProcessBpmn: ((id: string) => string | null) | undefined,
	deployed: Set<string>,
): void {
	// DMN decisions referenced via decisionId="..."
	if (getDecisionDmn) {
		for (const [, id] of xml.matchAll(/decisionId="([^"]+)"/g)) {
			if (!id || deployed.has(`dmn:${id}`)) continue
			deployed.add(`dmn:${id}`)
			const dmnXml = getDecisionDmn(id)
			if (dmnXml) engine.deploy(dmnXml)
		}
	}

	// Sub-processes / call activities referenced via calledElement="..."
	if (getProcessBpmn) {
		for (const [, id] of xml.matchAll(/calledElement="([^"]+)"/g)) {
			if (!id || deployed.has(`bpmn:${id}`)) continue
			deployed.add(`bpmn:${id}`)
			const bpmnXml = getProcessBpmn(id)
			if (bpmnXml) {
				// Recursively deploy that sub-process's own dependencies first
				deployDependencies(bpmnXml, engine, getDecisionDmn, getProcessBpmn, deployed)
				engine.deploy(bpmnXml)
			}
		}
	}
}

// ── Runner ─────────────────────────────────────────────────────────────────────

const MAX_ROUNDS = 200
const TIMEOUT_MS = 10_000

export async function runScenarioWasm(
	xml: string,
	scenario: ScenarioLike,
	getDecisionDmn?: (decisionId: string) => string | null,
	getProcessBpmn?: (processId: string) => string | null,
): Promise<ScenarioResultLike> {
	const startMs = Date.now()

	// Import and create a fresh engine for clean isolation
	const mod = await import("@bpmnkit/reebe-wasm")
	await mod.default()
	const engine = new mod.WasmEngine() as WasmEngineInstance

	try {
		// Deploy all referenced dependencies recursively before deploying the main BPMN.
		const deployed = new Set<string>()
		deployDependencies(xml, engine, getDecisionDmn, getProcessBpmn, deployed)

		// Deploy main BPMN
		const deployResult = engine.deploy(xml) as DeployResponse
		const processId = scenario.processId ?? deployResult.deployments[0]?.bpmnProcessId
		if (!processId) {
			return fail(scenario, startMs, "No process found in deployed BPMN.")
		}

		// Start instance
		engine.create_process_instance(processId, JSON.stringify(scenario.inputs ?? {}))

		// Drive jobs to completion
		for (let round = 0; round < MAX_ROUNDS; round++) {
			if (Date.now() - startMs > TIMEOUT_MS) break

			const snap = engine.snapshot() as WasmSnapshot
			const pi = snap.processInstances.find((p) => p.bpmn_process_id === processId)

			if (!pi || pi.state !== "ACTIVE") break

			const activatable = snap.jobs.filter(
				(j) => j.state === "ACTIVATABLE" && j.process_instance_key === pi.key,
			)
			if (activatable.length === 0) break

			for (const job of activatable) {
				try {
					engine.activate_job(job.key, "test-worker", 30_000)
					const mock = scenario.mocks?.[job.job_type]
					if (mock?.error !== undefined) {
						engine.fail_job(job.key, 0, mock.error)
					} else {
						engine.complete_job(job.key, JSON.stringify(mock?.outputs ?? {}))
					}
				} catch {
					// Job may have already been handled — skip
				}
			}
		}

		// Collect final state
		const snap = engine.snapshot() as WasmSnapshot
		const pi = snap.processInstances.find((p) => p.bpmn_process_id === processId)

		if (!pi) return fail(scenario, startMs, "Process instance not found after run.")

		const timedOut = pi.state === "ACTIVE" && Date.now() - startMs >= TIMEOUT_MS

		const visitedElements = snap.elementInstances
			.filter((e) => e.process_instance_key === pi.key)
			.map((e) => e.element_id)

		const finalVariables: Record<string, unknown> = {}
		for (const v of snap.variables.filter((v) => v.process_instance_key === pi.key)) {
			finalVariables[v.name] = v.value
		}

		const errors: ScenarioResultLike["errors"] = snap.incidents
			.filter((i) => i.process_instance_key === pi.key)
			.map((i) => ({ elementId: i.element_id, message: i.error_message ?? i.error_type }))

		if (timedOut) {
			errors.push({ message: `Scenario timed out after ${TIMEOUT_MS}ms` })
		}

		// Evaluate assertions
		const failures: ScenarioResultLike["failures"] = []

		if (scenario.expect?.path !== undefined) {
			let cursor = 0
			for (const expectedId of scenario.expect.path) {
				const idx = visitedElements.indexOf(expectedId, cursor)
				if (idx === -1) {
					failures.push({
						field: "path",
						expected: expectedId,
						actual: `not found in [${visitedElements.join(", ")}]`,
					})
				} else {
					cursor = idx + 1
				}
			}
		}

		if (scenario.expect?.variables !== undefined) {
			for (const [key, expectedValue] of Object.entries(scenario.expect.variables)) {
				const actualValue = finalVariables[key]
				if (JSON.stringify(actualValue) !== JSON.stringify(expectedValue)) {
					failures.push({ field: `variables.${key}`, expected: expectedValue, actual: actualValue })
				}
			}
		}

		return {
			scenarioId: scenario.id,
			scenarioName: scenario.name,
			passed: failures.length === 0,
			visitedElements,
			finalVariables,
			errors,
			failures,
			durationMs: Date.now() - startMs,
		}
	} finally {
		engine.free()
	}
}

function fail(scenario: ScenarioLike, startMs: number, message: string): ScenarioResultLike {
	return {
		scenarioId: scenario.id,
		scenarioName: scenario.name,
		passed: false,
		visitedElements: [],
		finalVariables: {},
		errors: [{ message }],
		failures: [{ field: "start", expected: "process to deploy and start", actual: message }],
		durationMs: Date.now() - startMs,
	}
}
