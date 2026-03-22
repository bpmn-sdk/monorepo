import { describe, expect, it } from "vitest"
import type {
	BpmnBoundaryEvent,
	BpmnFlowElement,
	BpmnProcess,
	BpmnSequenceFlow,
} from "../src/bpmn/bpmn-model.js"
import { analyzePatterns } from "../src/bpmn/optimize/patterns.js"
import type { XmlElement } from "../src/types/xml-element.js"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeProcess(
	elements: BpmnFlowElement[],
	flows: BpmnSequenceFlow[] = [],
	overrides?: Partial<BpmnProcess>,
): BpmnProcess {
	return {
		id: "Process_1",
		extensionElements: [],
		flowElements: elements,
		sequenceFlows: flows,
		textAnnotations: [],
		associations: [],
		unknownAttributes: {},
		...overrides,
	}
}

function taskDef(type: string): XmlElement {
	return { name: "zeebe:taskDefinition", attributes: { type }, children: [] }
}

function ioMapping(outputs: { source: string; target: string }[]): XmlElement {
	return {
		name: "zeebe:ioMapping",
		attributes: {},
		children: outputs.map((o) => ({
			name: "zeebe:output",
			attributes: { source: o.source, target: o.target },
			children: [],
		})),
	}
}

function errorBoundary(id: string, attachedToRef: string): BpmnBoundaryEvent {
	return {
		type: "boundaryEvent",
		id,
		name: undefined,
		attachedToRef,
		incoming: [],
		outgoing: [],
		extensionElements: [],
		unknownAttributes: {},
		eventDefinitions: [{ type: "error" }],
	}
}

function timerBoundary(id: string, attachedToRef: string, duration?: string): BpmnBoundaryEvent {
	return {
		type: "boundaryEvent",
		id,
		name: undefined,
		attachedToRef,
		incoming: [],
		outgoing: ["Flow_out"],
		extensionElements: [],
		unknownAttributes: {},
		eventDefinitions: [{ type: "timer", timeDuration: duration ?? "PT1H" }],
	}
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("analyzePatterns", () => {
	// ── Rule 1: HTTP service task without error boundary ──────────────────────
	describe("pattern/http-no-error-boundary", () => {
		it("flags HTTP service task without error boundary", () => {
			const p = makeProcess([
				{
					type: "serviceTask",
					id: "Task_1",
					incoming: [],
					outgoing: [],
					extensionElements: [taskDef("io.camunda.connector.HttpJson:1")],
					unknownAttributes: {},
				},
			])
			const findings = analyzePatterns(p)
			expect(findings.some((f) => f.id === "pattern/http-no-error-boundary")).toBe(true)
		})

		it("does not flag HTTP service task with error boundary", () => {
			const p = makeProcess([
				{
					type: "serviceTask",
					id: "Task_1",
					incoming: [],
					outgoing: [],
					extensionElements: [taskDef("io.camunda.connector.HttpJson:1")],
					unknownAttributes: {},
				},
				errorBoundary("Boundary_1", "Task_1"),
			])
			const findings = analyzePatterns(p)
			expect(findings.some((f) => f.id === "pattern/http-no-error-boundary")).toBe(false)
		})

		it("does not flag non-HTTP service task", () => {
			const p = makeProcess([
				{
					type: "serviceTask",
					id: "Task_1",
					incoming: [],
					outgoing: [],
					extensionElements: [taskDef("com.example.myWorker")],
					unknownAttributes: {},
				},
			])
			const findings = analyzePatterns(p)
			expect(findings.some((f) => f.id === "pattern/http-no-error-boundary")).toBe(false)
		})
	})

	// ── Rule 2: Exclusive gateway without default flow ────────────────────────
	describe("pattern/gateway-no-default-flow", () => {
		it("flags exclusive gateway with multiple outgoing but no default", () => {
			const p = makeProcess(
				[
					{
						type: "exclusiveGateway",
						id: "Gateway_1",
						incoming: ["Flow_0"],
						outgoing: ["Flow_1", "Flow_2"],
						extensionElements: [],
						unknownAttributes: {},
					},
				],
				[
					{
						id: "Flow_1",
						sourceRef: "Gateway_1",
						targetRef: "Task_1",
						extensionElements: [],
						unknownAttributes: {},
					},
					{
						id: "Flow_2",
						sourceRef: "Gateway_1",
						targetRef: "Task_2",
						extensionElements: [],
						unknownAttributes: {},
					},
				],
			)
			const findings = analyzePatterns(p)
			expect(findings.some((f) => f.id === "pattern/gateway-no-default-flow")).toBe(true)
		})

		it("does not flag exclusive gateway with default flow set", () => {
			const p = makeProcess(
				[
					{
						type: "exclusiveGateway",
						id: "Gateway_1",
						incoming: ["Flow_0"],
						outgoing: ["Flow_1", "Flow_2"],
						default: "Flow_2",
						extensionElements: [],
						unknownAttributes: {},
					},
				],
				[
					{
						id: "Flow_1",
						sourceRef: "Gateway_1",
						targetRef: "Task_1",
						extensionElements: [],
						unknownAttributes: {},
					},
					{
						id: "Flow_2",
						sourceRef: "Gateway_1",
						targetRef: "Task_2",
						extensionElements: [],
						unknownAttributes: {},
					},
				],
			)
			const findings = analyzePatterns(p)
			expect(findings.some((f) => f.id === "pattern/gateway-no-default-flow")).toBe(false)
		})
	})

	// ── Rule 6: User task without timer boundary ──────────────────────────────
	describe("pattern/user-task-no-timer", () => {
		it("flags user task without timer boundary", () => {
			const p = makeProcess([
				{
					type: "userTask",
					id: "UserTask_1",
					incoming: [],
					outgoing: [],
					extensionElements: [],
					unknownAttributes: {},
				},
			])
			const findings = analyzePatterns(p)
			expect(findings.some((f) => f.id === "pattern/user-task-no-timer")).toBe(true)
		})

		it("does not flag user task with timer boundary", () => {
			const p = makeProcess([
				{
					type: "userTask",
					id: "UserTask_1",
					incoming: [],
					outgoing: [],
					extensionElements: [],
					unknownAttributes: {},
				},
				timerBoundary("Boundary_1", "UserTask_1"),
			])
			const findings = analyzePatterns(p)
			expect(findings.some((f) => f.id === "pattern/user-task-no-timer")).toBe(false)
		})
	})

	// ── Rule 7: Service task output mapping with no result variable ───────────
	describe("pattern/service-task-no-output", () => {
		it("flags service task with job type but no output mapping", () => {
			const p = makeProcess([
				{
					type: "serviceTask",
					id: "Task_1",
					incoming: [],
					outgoing: [],
					extensionElements: [taskDef("com.example.worker")],
					unknownAttributes: {},
				},
			])
			const findings = analyzePatterns(p)
			expect(findings.some((f) => f.id === "pattern/service-task-no-output")).toBe(true)
		})

		it("does not flag service task with output mapping", () => {
			const p = makeProcess([
				{
					type: "serviceTask",
					id: "Task_1",
					incoming: [],
					outgoing: [],
					extensionElements: [
						taskDef("com.example.worker"),
						ioMapping([{ source: "= result", target: "myResult" }]),
					],
					unknownAttributes: {},
				},
			])
			const findings = analyzePatterns(p)
			expect(findings.some((f) => f.id === "pattern/service-task-no-output")).toBe(false)
		})
	})

	// ── Rule 9: Exclusive gateway with single outgoing flow ───────────────────
	describe("pattern/gateway-single-outgoing", () => {
		it("flags exclusive gateway with only one outgoing flow", () => {
			const p = makeProcess(
				[
					{
						type: "exclusiveGateway",
						id: "Gateway_1",
						incoming: ["Flow_0"],
						outgoing: ["Flow_1"],
						extensionElements: [],
						unknownAttributes: {},
					},
				],
				[
					{
						id: "Flow_1",
						sourceRef: "Gateway_1",
						targetRef: "Task_1",
						extensionElements: [],
						unknownAttributes: {},
					},
				],
			)
			const findings = analyzePatterns(p)
			expect(findings.some((f) => f.id === "pattern/gateway-single-outgoing")).toBe(true)
		})
	})

	// ── Rule 11: Timer boundary with duration 0 ───────────────────────────────
	describe("pattern/timer-duration-zero", () => {
		it("flags timer boundary with PT0S duration", () => {
			const p = makeProcess([
				{
					type: "serviceTask",
					id: "Task_1",
					incoming: [],
					outgoing: [],
					extensionElements: [],
					unknownAttributes: {},
				},
				timerBoundary("Boundary_1", "Task_1", "PT0S"),
			])
			const findings = analyzePatterns(p)
			expect(findings.some((f) => f.id === "pattern/timer-duration-zero")).toBe(true)
		})

		it("does not flag timer boundary with non-zero duration", () => {
			const p = makeProcess([
				{
					type: "serviceTask",
					id: "Task_1",
					incoming: [],
					outgoing: [],
					extensionElements: [],
					unknownAttributes: {},
				},
				timerBoundary("Boundary_1", "Task_1", "PT1H"),
			])
			const findings = analyzePatterns(p)
			expect(findings.some((f) => f.id === "pattern/timer-duration-zero")).toBe(false)
		})
	})

	// ── Rule 12: Boundary event with no outgoing flow ─────────────────────────
	describe("pattern/boundary-no-outgoing", () => {
		it("flags boundary event with no outgoing flow", () => {
			const p = makeProcess(
				[
					{
						type: "serviceTask",
						id: "Task_1",
						incoming: [],
						outgoing: [],
						extensionElements: [],
						unknownAttributes: {},
					},
					{
						type: "boundaryEvent",
						id: "Boundary_1",
						attachedToRef: "Task_1",
						incoming: [],
						outgoing: [], // no outgoing
						extensionElements: [],
						unknownAttributes: {},
						eventDefinitions: [{ type: "error" }],
					},
				],
				[],
			)
			const findings = analyzePatterns(p)
			expect(findings.some((f) => f.id === "pattern/boundary-no-outgoing")).toBe(true)
		})
	})

	// ── Rule 13: Empty text annotation ───────────────────────────────────────
	describe("pattern/empty-annotation", () => {
		it("flags empty text annotation", () => {
			const p = makeProcess([], [], {
				textAnnotations: [{ id: "Ann_1", text: "", unknownAttributes: {} }],
			})
			const findings = analyzePatterns(p)
			expect(findings.some((f) => f.id === "pattern/empty-annotation")).toBe(true)
		})

		it("does not flag annotation with text", () => {
			const p = makeProcess([], [], {
				textAnnotations: [{ id: "Ann_1", text: "This is a note", unknownAttributes: {} }],
			})
			const findings = analyzePatterns(p)
			expect(findings.some((f) => f.id === "pattern/empty-annotation")).toBe(false)
		})
	})

	// ── Rule 14: Duplicate job type ───────────────────────────────────────────
	describe("pattern/duplicate-job-type", () => {
		it("flags duplicate job types across service tasks", () => {
			const p = makeProcess([
				{
					type: "serviceTask",
					id: "Task_1",
					incoming: [],
					outgoing: [],
					extensionElements: [taskDef("com.example.worker")],
					unknownAttributes: {},
				},
				{
					type: "serviceTask",
					id: "Task_2",
					incoming: [],
					outgoing: [],
					extensionElements: [taskDef("com.example.worker")],
					unknownAttributes: {},
				},
			])
			const findings = analyzePatterns(p)
			const dup = findings.find((f) => f.id === "pattern/duplicate-job-type")
			expect(dup).toBeDefined()
			expect(dup?.elementIds).toEqual(["Task_1", "Task_2"])
		})

		it("does not flag distinct job types", () => {
			const p = makeProcess([
				{
					type: "serviceTask",
					id: "Task_1",
					incoming: [],
					outgoing: [],
					extensionElements: [taskDef("com.example.worker-a")],
					unknownAttributes: {},
				},
				{
					type: "serviceTask",
					id: "Task_2",
					incoming: [],
					outgoing: [],
					extensionElements: [taskDef("com.example.worker-b")],
					unknownAttributes: {},
				},
			])
			const findings = analyzePatterns(p)
			expect(findings.some((f) => f.id === "pattern/duplicate-job-type")).toBe(false)
		})
	})

	// ── Rule 15: FEEL literal-only condition ──────────────────────────────────
	describe("pattern/literal-condition", () => {
		it("flags condition with literal true", () => {
			const p = makeProcess(
				[
					{
						type: "exclusiveGateway",
						id: "Gateway_1",
						incoming: [],
						outgoing: ["Flow_1"],
						extensionElements: [],
						unknownAttributes: {},
					},
				],
				[
					{
						id: "Flow_1",
						sourceRef: "Gateway_1",
						targetRef: "Task_1",
						conditionExpression: { text: "= true", attributes: {} },
						extensionElements: [],
						unknownAttributes: {},
					},
				],
			)
			const findings = analyzePatterns(p)
			expect(findings.some((f) => f.id === "pattern/literal-condition")).toBe(true)
		})

		it("does not flag condition with variable reference", () => {
			const p = makeProcess(
				[
					{
						type: "exclusiveGateway",
						id: "Gateway_1",
						incoming: [],
						outgoing: ["Flow_1"],
						extensionElements: [],
						unknownAttributes: {},
					},
				],
				[
					{
						id: "Flow_1",
						sourceRef: "Gateway_1",
						targetRef: "Task_1",
						conditionExpression: { text: "= approved = true", attributes: {} },
						extensionElements: [],
						unknownAttributes: {},
					},
				],
			)
			const findings = analyzePatterns(p)
			expect(findings.some((f) => f.id === "pattern/literal-condition")).toBe(false)
		})
	})
})
