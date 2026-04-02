/**
 * Multi-instance sub-process adapter tests.
 * Verifies that the SUB_PROCESS_ADAPTER reads and writes loopCharacteristics
 * correctly, and that the BPMN model round-trips isSequential through XML.
 */
import type { BpmnDefinitions } from "@bpmnkit/core"
import { Bpmn } from "@bpmnkit/core"
import { describe, expect, it, vi } from "vitest"
import { createConfigPanelBpmnPlugin } from "../../src/config-panel-bpmn/index.js"
import {
	buildZeebeLoopCharacteristics,
	parseZeebeLoopCharacteristics,
} from "../../src/config-panel-bpmn/util.js"

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeSubProcessDefs(
	id = "sp1",
	opts: {
		loopCharacteristics?: {
			isSequential?: boolean
			collection?: string
			elementVariable?: string
		}
	} = {},
): BpmnDefinitions {
	const lc = opts.loopCharacteristics
	let loopCharacteristics: BpmnDefinitions["processes"][0]["flowElements"][0] extends {
		loopCharacteristics?: infer L
	}
		? L
		: never
	if (lc) {
		const extEls = lc.collection
			? [
					buildZeebeLoopCharacteristics({
						inputCollection: lc.collection,
						inputElement: lc.elementVariable ?? "",
					}),
				]
			: []
		loopCharacteristics = { isSequential: lc.isSequential, extensionElements: extEls }
	}

	return {
		id: "defs1",
		targetNamespace: "http://bpmn.io/schema/bpmn",
		namespaces: {},
		unknownAttributes: {},
		errors: [],
		escalations: [],
		messages: [],
		collaborations: [],
		processes: [
			{
				id: "proc1",
				extensionElements: [],
				flowElements: [
					{
						id,
						type: "subProcess",
						name: "Process emails",
						incoming: [],
						outgoing: [],
						extensionElements: [],
						unknownAttributes: {},
						triggeredByEvent: false,
						loopCharacteristics,
						flowElements: [],
						sequenceFlows: [],
						textAnnotations: [],
						associations: [],
					},
				],
				sequenceFlows: [],
				textAnnotations: [],
				associations: [],
				unknownAttributes: {},
			},
		],
		diagrams: [],
	}
}

/** Install plugin and return the adapter registered for a given element type. */
function getAdapter(type: string): {
	read: (defs: BpmnDefinitions, id: string) => Record<string, unknown>
	write: (defs: BpmnDefinitions, id: string, values: Record<string, unknown>) => BpmnDefinitions
} {
	const adapters = new Map<
		string,
		{
			read: (defs: BpmnDefinitions, id: string) => Record<string, unknown>
			write: (defs: BpmnDefinitions, id: string, values: Record<string, unknown>) => BpmnDefinitions
		}
	>()
	const mockPanel = {
		name: "config-panel",
		install: vi.fn(),
		uninstall: vi.fn(),
		registerSchema: vi.fn(
			(
				t: string,
				_schema: unknown,
				adapter: {
					read: (defs: BpmnDefinitions, id: string) => Record<string, unknown>
					write: (
						defs: BpmnDefinitions,
						id: string,
						values: Record<string, unknown>,
					) => BpmnDefinitions
				},
			) => {
				adapters.set(t, adapter)
			},
		),
	}
	const plugin = createConfigPanelBpmnPlugin(mockPanel)
	plugin.install({
		container: document.createElement("div"),
		svg: document.createElementNS("http://www.w3.org/2000/svg", "svg") as SVGSVGElement,
		viewportEl: document.createElementNS("http://www.w3.org/2000/svg", "g") as SVGGElement,
		getViewport: () => ({ tx: 0, ty: 0, scale: 1 }),
		setViewport: vi.fn(),
		getShapes: () => [],
		getEdges: () => [],
		getTheme: () => "dark" as const,
		setTheme: vi.fn(),
		on: (_e: unknown, _h: unknown) => () => {},
		emit: vi.fn(),
	})
	const adapter = adapters.get(type)
	if (!adapter) throw new Error(`No adapter registered for ${type}`)
	return adapter
}

// ── parseZeebeLoopCharacteristics ─────────────────────────────────────────────

describe("parseZeebeLoopCharacteristics", () => {
	it("returns undefined for empty extension elements", () => {
		expect(parseZeebeLoopCharacteristics([])).toBeUndefined()
	})

	it("parses inputCollection and inputElement", () => {
		const ext = [
			buildZeebeLoopCharacteristics({ inputCollection: "= emails", inputElement: "email" }),
		]
		const result = parseZeebeLoopCharacteristics(ext)
		expect(result).toEqual({
			inputCollection: "= emails",
			inputElement: "email",
			outputCollection: undefined,
			outputElement: undefined,
		})
	})

	it("returns empty strings for missing attributes", () => {
		const ext = [{ name: "zeebe:loopCharacteristics", attributes: {}, children: [] }]
		const result = parseZeebeLoopCharacteristics(ext)
		expect(result?.inputCollection).toBe("")
		expect(result?.inputElement).toBe("")
	})
})

// ── Sub-process adapter ───────────────────────────────────────────────────────

describe("sub-process adapter — read", () => {
	it("reads mode=none for sub-process without loopCharacteristics", () => {
		const adapter = getAdapter("subProcess")
		const defs = makeSubProcessDefs("sp1")
		const values = adapter.read(defs, "sp1")
		expect(values.multiInstanceMode).toBe("none")
		expect(values.collection).toBe("")
		expect(values.elementVariable).toBe("")
	})

	it("reads mode=parallel for parallel loopCharacteristics", () => {
		const adapter = getAdapter("subProcess")
		const defs = makeSubProcessDefs("sp1", {
			loopCharacteristics: { collection: "= emails", elementVariable: "email" },
		})
		const values = adapter.read(defs, "sp1")
		expect(values.multiInstanceMode).toBe("parallel")
		expect(values.collection).toBe("= emails")
		expect(values.elementVariable).toBe("email")
	})

	it("reads mode=sequential for sequential loopCharacteristics", () => {
		const adapter = getAdapter("subProcess")
		const defs = makeSubProcessDefs("sp1", {
			loopCharacteristics: { isSequential: true, collection: "= items", elementVariable: "item" },
		})
		const values = adapter.read(defs, "sp1")
		expect(values.multiInstanceMode).toBe("sequential")
		expect(values.collection).toBe("= items")
	})
})

describe("sub-process adapter — write", () => {
	it("removes loopCharacteristics when mode=none", () => {
		const adapter = getAdapter("subProcess")
		const defs = makeSubProcessDefs("sp1", {
			loopCharacteristics: { collection: "= emails", elementVariable: "email" },
		})
		const updated = adapter.write(defs, "sp1", { multiInstanceMode: "none" })
		const el = updated.processes[0]?.flowElements.find((e) => e.id === "sp1")
		expect(el != null && "loopCharacteristics" in el && el.loopCharacteristics).toBeUndefined()
	})

	it("writes parallel loopCharacteristics with collection and elementVariable", () => {
		const adapter = getAdapter("subProcess")
		const defs = makeSubProcessDefs("sp1")
		const updated = adapter.write(defs, "sp1", {
			multiInstanceMode: "parallel",
			collection: "= emails",
			elementVariable: "email",
		})
		const el = updated.processes[0]?.flowElements.find((e) => e.id === "sp1") as {
			loopCharacteristics?: { isSequential?: boolean; extensionElements: unknown[] }
		}
		expect(el.loopCharacteristics?.isSequential).toBeUndefined()
		const loop = parseZeebeLoopCharacteristics(
			el.loopCharacteristics?.extensionElements as ReturnType<
				typeof buildZeebeLoopCharacteristics
			>[],
		)
		expect(loop?.inputCollection).toBe("= emails")
		expect(loop?.inputElement).toBe("email")
	})

	it("writes isSequential=true for sequential mode", () => {
		const adapter = getAdapter("subProcess")
		const defs = makeSubProcessDefs("sp1")
		const updated = adapter.write(defs, "sp1", {
			multiInstanceMode: "sequential",
			collection: "= items",
			elementVariable: "item",
		})
		const el = updated.processes[0]?.flowElements.find((e) => e.id === "sp1") as {
			loopCharacteristics?: { isSequential?: boolean; extensionElements: unknown[] }
		}
		expect(el.loopCharacteristics?.isSequential).toBe(true)
	})
})

// ── BPMN XML round-trip ───────────────────────────────────────────────────────

describe("BPMN XML round-trip — isSequential", () => {
	it("exports and re-parses isSequential=true", () => {
		const defs = makeSubProcessDefs("sp1", {
			loopCharacteristics: { isSequential: true, collection: "= items", elementVariable: "item" },
		})
		const xml = Bpmn.export(defs)
		expect(xml).toContain('isSequential="true"')

		const reparsed = Bpmn.parse(xml)
		const sp = reparsed.processes[0]?.flowElements.find((e) => e.id === "sp1") as {
			loopCharacteristics?: { isSequential?: boolean }
		}
		expect(sp.loopCharacteristics?.isSequential).toBe(true)
	})

	it("does not export isSequential for parallel mode", () => {
		const defs = makeSubProcessDefs("sp1", {
			loopCharacteristics: { collection: "= items", elementVariable: "item" },
		})
		const xml = Bpmn.export(defs)
		expect(xml).not.toContain("isSequential")

		const reparsed = Bpmn.parse(xml)
		const sp = reparsed.processes[0]?.flowElements.find((e) => e.id === "sp1") as {
			loopCharacteristics?: { isSequential?: boolean; extensionElements: unknown[] }
		}
		expect(sp.loopCharacteristics?.isSequential).toBeUndefined()
		expect(sp.loopCharacteristics?.extensionElements.length).toBeGreaterThan(0)
	})

	it("exports and re-parses zeebe:loopCharacteristics inputCollection", () => {
		const defs = makeSubProcessDefs("sp1", {
			loopCharacteristics: { collection: "= emails", elementVariable: "email" },
		})
		const xml = Bpmn.export(defs)
		expect(xml).toContain('inputCollection="= emails"')
		expect(xml).toContain('inputElement="email"')
	})
})
