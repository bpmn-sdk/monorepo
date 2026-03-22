import type { BpmnDefinitions } from "@bpmnkit/core"
import type { Engine } from "./engine.js"

// ── Scenario types ─────────────────────────────────────────────────────────────

/** A worker mock for a specific task type. */
export interface ScenarioMock {
	/** Variables to output when the task completes. */
	outputs?: Record<string, unknown>
	/** If set, the worker throws this error instead of completing. */
	error?: string
}

/** Expected results that the scenario should assert. */
export interface ScenarioExpect {
	/** Ordered list of element IDs that must be visited (in order, may be a subset). */
	path?: string[]
	/** Variables that must be present in the final process state. */
	variables?: Record<string, unknown>
}

/** A single test scenario for a BPMN process. */
export interface ProcessScenario {
	id: string
	name: string
	/** Process ID to run. Defaults to the first process in the definitions. */
	processId?: string
	/** Initial variables passed to the process. */
	inputs?: Record<string, unknown>
	/** Job worker mocks keyed by task type. */
	mocks?: Record<string, ScenarioMock>
	/** Assertions to check after the run. */
	expect?: ScenarioExpect
}

/** Result of a single scenario run. */
export interface ScenarioResult {
	scenarioId: string
	scenarioName: string
	passed: boolean
	/** Elements visited (type: element:entered) in order. */
	visitedElements: string[]
	/** Final variable state. */
	finalVariables: Record<string, unknown>
	/** Errors collected during the run. */
	errors: Array<{ elementId?: string; message: string }>
	/** Assertion failures, each describing what was expected vs. actual. */
	failures: Array<{ field: string; expected: unknown; actual: unknown }>
	/** Time taken in milliseconds. */
	durationMs: number
}

// ── Runner ─────────────────────────────────────────────────────────────────────

const DEFAULT_TIMEOUT_MS = 5_000

/**
 * Run a single test scenario against a deployed BPMN definition.
 * Registers mock workers, runs the process, then checks assertions.
 *
 * @param engine  An `Engine` instance (fresh or shared — caller decides).
 * @param defs    BPMN definitions to deploy.
 * @param scenario  The scenario to run.
 * @param timeoutMs  How long to wait for the process to complete (default 5 s).
 */
export function runScenario(
	engine: Engine,
	defs: BpmnDefinitions,
	scenario: ProcessScenario,
	timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<ScenarioResult> {
	return new Promise((resolve) => {
		const startMs = Date.now()
		engine.deploy({ bpmn: defs })

		const processId = scenario.processId ?? defs.processes[0]?.id
		if (processId === undefined) {
			resolve({
				scenarioId: scenario.id,
				scenarioName: scenario.name,
				passed: false,
				visitedElements: [],
				finalVariables: {},
				errors: [{ message: "No process found in definitions." }],
				failures: [{ field: "processId", expected: "a deployed process", actual: undefined }],
				durationMs: Date.now() - startMs,
			})
			return
		}

		// Register mock workers
		const unregisterWorkers: Array<() => void> = []
		for (const [taskType, mock] of Object.entries(scenario.mocks ?? {})) {
			const off = engine.registerJobWorker(taskType, (job) => {
				if (mock.error !== undefined) {
					job.fail(mock.error)
				} else {
					job.complete(mock.outputs ?? {})
				}
			})
			unregisterWorkers.push(off)
		}

		const visitedElements: string[] = []
		const variableState = new Map<string, unknown>()
		const errors: Array<{ elementId?: string; message: string }> = []

		let settled = false
		let timeoutHandle: ReturnType<typeof setTimeout> | undefined

		function finish(finalVars: Record<string, unknown>): void {
			if (settled) return
			settled = true
			clearTimeout(timeoutHandle)
			for (const off of unregisterWorkers) off()

			// Merge variable state with any final vars from process:completed
			for (const [k, v] of Object.entries(finalVars)) variableState.set(k, v)
			const finalVariables: Record<string, unknown> = Object.fromEntries(variableState)

			// Evaluate assertions
			const failures: Array<{ field: string; expected: unknown; actual: unknown }> = []

			if (scenario.expect?.path !== undefined) {
				const expectedPath = scenario.expect.path
				// Check that each expected element appears in order within visitedElements
				let cursor = 0
				for (const expectedId of expectedPath) {
					const idx = visitedElements.indexOf(expectedId, cursor)
					if (idx === -1) {
						failures.push({
							field: `path[${expectedPath.indexOf(expectedId)}]`,
							expected: expectedId,
							actual: `not found after position ${cursor} in [${visitedElements.join(", ")}]`,
						})
					} else {
						cursor = idx + 1
					}
				}
			}

			if (scenario.expect?.variables !== undefined) {
				for (const [key, expectedValue] of Object.entries(scenario.expect.variables)) {
					const actualValue = finalVariables[key]
					const match = JSON.stringify(actualValue) === JSON.stringify(expectedValue)
					if (!match) {
						failures.push({
							field: `variables.${key}`,
							expected: expectedValue,
							actual: actualValue,
						})
					}
				}
			}

			resolve({
				scenarioId: scenario.id,
				scenarioName: scenario.name,
				passed: failures.length === 0,
				visitedElements,
				finalVariables,
				errors,
				failures,
				durationMs: Date.now() - startMs,
			})
		}

		timeoutHandle = setTimeout(() => {
			if (settled) return
			errors.push({ message: `Scenario timed out after ${timeoutMs}ms` })
			finish({})
		}, timeoutMs)

		let instance: ReturnType<Engine["start"]>
		try {
			instance = engine.start(processId, scenario.inputs ?? {})
		} catch (err) {
			clearTimeout(timeoutHandle)
			for (const off of unregisterWorkers) off()
			const msg = err instanceof Error ? err.message : String(err)
			resolve({
				scenarioId: scenario.id,
				scenarioName: scenario.name,
				passed: false,
				visitedElements: [],
				finalVariables: {},
				errors: [{ message: msg }],
				failures: [{ field: "start", expected: "process to start", actual: msg }],
				durationMs: Date.now() - startMs,
			})
			return
		}

		instance.onChange((evt) => {
			if (evt.type === "element:entered") {
				visitedElements.push(evt.elementId)
			} else if (evt.type === "variable:set") {
				variableState.set(evt.name, evt.value)
			} else if (evt.type === "element:failed") {
				errors.push({ elementId: evt.elementId, message: evt.error })
			} else if (evt.type === "process:failed") {
				errors.push({ message: evt.error })
				finish({})
			} else if (evt.type === "process:completed") {
				finish(evt.variables)
			}
		})
	})
}
