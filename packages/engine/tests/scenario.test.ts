import type { BpmnDefinitions, BpmnProcess } from "@bpmnkit/core"
import { describe, expect, it } from "vitest"
import { Engine } from "../src/engine.js"
import { runScenario } from "../src/scenario.js"

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeDefs(processes: BpmnProcess[]): BpmnDefinitions {
	return {
		id: "Definitions_1",
		targetNamespace: "http://bpmn.io/schema/bpmn",
		namespaces: {},
		unknownAttributes: {},
		errors: [],
		escalations: [],
		messages: [],
		collaborations: [],
		processes,
		diagrams: [],
	}
}

function node(
	type: BpmnProcess["flowElements"][number]["type"],
	id: string,
	incoming: string[] = [],
	outgoing: string[] = [],
): BpmnProcess["flowElements"][number] {
	return {
		type,
		id,
		name: id,
		incoming,
		outgoing,
		extensionElements: [],
		unknownAttributes: {},
		eventDefinitions: [],
	} as BpmnProcess["flowElements"][number]
}

function flow(id: string, src: string, tgt: string): BpmnProcess["sequenceFlows"][number] {
	return {
		id,
		type: "sequenceFlow",
		sourceRef: src,
		targetRef: tgt,
		name: "",
		extensionElements: [],
		unknownAttributes: {},
	}
}

function makeProcess(
	id: string,
	flowElements: BpmnProcess["flowElements"],
	sequenceFlows: BpmnProcess["sequenceFlows"] = [],
): BpmnProcess {
	return {
		id,
		isExecutable: true,
		extensionElements: [],
		flowElements,
		sequenceFlows,
		textAnnotations: [],
		associations: [],
		unknownAttributes: {},
	}
}

/** Build a simple start → serviceTask → end process with a job worker task. */
function simpleServiceDefs(processId = "Process_1"): BpmnDefinitions {
	const start = node("startEvent", "Start_1", [], ["f1"])
	const task = {
		...node("serviceTask", "Task_1", ["f1"], ["f2"]),
		extensionElements: [
			{
				name: "zeebe:taskDefinition",
				attributes: { type: "my-service" },
				children: [],
			},
		],
	}
	const end = node("endEvent", "End_1", ["f2"], [])
	const process = makeProcess(
		processId,
		[start, task, end],
		[flow("f1", "Start_1", "Task_1"), flow("f2", "Task_1", "End_1")],
	)
	return makeDefs([process])
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("runScenario", () => {
	it("passes when path and variables match", async () => {
		const defs = simpleServiceDefs()
		const engine = new Engine()

		const result = await runScenario(engine, defs, {
			id: "s1",
			name: "Happy path",
			inputs: { orderId: 42 },
			mocks: {
				"my-service": { outputs: { status: "done" } },
			},
			expect: {
				path: ["Start_1", "Task_1", "End_1"],
				variables: { status: "done" },
			},
		})

		expect(result.passed).toBe(true)
		expect(result.failures).toHaveLength(0)
		expect(result.visitedElements).toContain("Task_1")
	})

	it("fails when expected path element is missing", async () => {
		const defs = simpleServiceDefs()
		const engine = new Engine()

		const result = await runScenario(engine, defs, {
			id: "s2",
			name: "Missing element",
			mocks: { "my-service": { outputs: {} } },
			expect: { path: ["Start_1", "NeverExists", "End_1"] },
		})

		expect(result.passed).toBe(false)
		const pathFailure = result.failures.find((f) => f.field.startsWith("path["))
		expect(pathFailure).toBeDefined()
		expect(pathFailure?.expected).toBe("NeverExists")
	})

	it("fails when expected variable has wrong value", async () => {
		const defs = simpleServiceDefs()
		const engine = new Engine()

		const result = await runScenario(engine, defs, {
			id: "s3",
			name: "Wrong variable",
			mocks: { "my-service": { outputs: { status: "done" } } },
			expect: { variables: { status: "expected-other" } },
		})

		expect(result.passed).toBe(false)
		expect(result.failures[0]?.field).toBe("variables.status")
		expect(result.failures[0]?.expected).toBe("expected-other")
		expect(result.failures[0]?.actual).toBe("done")
	})

	it("records errors when the worker fails", async () => {
		const defs = simpleServiceDefs()
		const engine = new Engine()

		const result = await runScenario(engine, defs, {
			id: "s4",
			name: "Worker error",
			mocks: { "my-service": { error: "Service unavailable" } },
		})

		expect(result.errors.length).toBeGreaterThan(0)
	})

	it("fails immediately for an unknown process", async () => {
		const defs = makeDefs([])
		const engine = new Engine()

		const result = await runScenario(engine, defs, { id: "s5", name: "No process" })

		expect(result.passed).toBe(false)
		expect(result.errors[0]?.message).toContain("No process")
	})
})
