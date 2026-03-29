import { DecisionTableBuilder } from "../dmn/dmn-builder.js"
import { parseDmn } from "../dmn/dmn-parser.js"
import { generateId } from "../types/id-generator.js"
import type {
	BpmnBusinessRuleTask,
	BpmnDefinitions,
	BpmnDiEdge,
	BpmnDiShape,
	BpmnEndEvent,
	BpmnError,
	BpmnExclusiveGateway,
	BpmnProcess,
	BpmnSequenceFlow,
} from "./bpmn-model.js"
import { getZeebeExtensions } from "./utils.js"
import { zeebeExtensionsToXmlElements } from "./zeebe-extensions.js"

// ── Public types ──────────────────────────────────────────────────────────────

/** Supported variable types for input validation. */
export type ValidationVariableType = "string" | "number" | "boolean" | "context" | "list" | "any"

/** A single input variable definition used to build a validation DMN. */
export interface InputVariableDef {
	/** Variable name (must be a valid FEEL identifier). */
	name: string
	/** Expected type. */
	type: ValidationVariableType
	/** When true, generates a required check row. */
	required: boolean
	/** Minimum numeric value (number type only). */
	min?: number
	/** Maximum numeric value (number type only). */
	max?: number
	/** Minimum string length (string type only). */
	minLength?: number
	/** Maximum string length (string type only). */
	maxLength?: number
	/** Regex pattern the value must match (string type only). */
	pattern?: string
}

/** Location of a validation structure wired after a start event. */
export interface ValidationStructure {
	businessRuleTaskId: string
	decisionId: string
}

// ── Decision ID ───────────────────────────────────────────────────────────────

/**
 * Returns the deterministic DMN decision ID for the validation decision linked
 * to a given start event.
 */
export function validationDecisionId(startEventId: string): string {
	return `${startEventId}_inputValidation`
}

// ── DMN factory ───────────────────────────────────────────────────────────────

/**
 * Builds a validation DMN XML string from a list of variable definitions.
 *
 * Uses the Collect hit policy so every violated rule contributes an error
 * string to the `validationErrors` list. An empty list means valid input.
 */
export function buildValidationDmn(startEventId: string, variables: InputVariableDef[]): string {
	const decisionId = validationDecisionId(startEventId)
	const builder = new DecisionTableBuilder(decisionId)
		.name("Input Validation")
		.hitPolicy("COLLECT")

	for (const v of variables) {
		builder.input({
			label: v.name,
			expression: v.name,
		})
	}

	builder.output({ label: "Error", name: "error", typeRef: "string" })

	for (let i = 0; i < variables.length; i++) {
		const v = variables[i]
		if (!v) continue

		/** Build a rule that fires (on violation) for variable at index i. */
		const addRow = (entry: string, message: string) => {
			const inputs = variables.map((_, j) => (j === i ? entry : ""))
			builder.rule({ inputs, outputs: [`"${message}"`] })
		}

		if (v.required) {
			addRow("null", `${v.name} is required`)
		}

		if (v.type === "string") {
			addRow("not(instance of string)", `${v.name} must be a string`)
		} else if (v.type === "number") {
			addRow("not(instance of number)", `${v.name} must be a number`)
		} else if (v.type === "boolean") {
			addRow("not(instance of boolean)", `${v.name} must be a boolean`)
		}

		if (v.type === "string") {
			if (v.minLength !== undefined) {
				addRow(`string length(?) < ${v.minLength}`, `${v.name} must be at least ${v.minLength} characters`)
			}
			if (v.maxLength !== undefined) {
				addRow(`string length(?) > ${v.maxLength}`, `${v.name} must be at most ${v.maxLength} characters`)
			}
			if (v.pattern) {
				addRow(`not(matches(?, "${v.pattern}"))`, `${v.name} has invalid format`)
			}
		} else if (v.type === "number") {
			if (v.min !== undefined) {
				addRow(`< ${v.min}`, `${v.name} must be >= ${v.min}`)
			}
			if (v.max !== undefined) {
				addRow(`> ${v.max}`, `${v.name} must be <= ${v.max}`)
			}
		}
	}

	return builder.toXml()
}

// ── BPMN structure detection ──────────────────────────────────────────────────

/** Returns the process that contains the given element id, or undefined. */
function findProcessFor(defs: BpmnDefinitions, elementId: string): BpmnProcess | undefined {
	return defs.processes.find((p) => p.flowElements.some((e) => e.id === elementId))
}

/**
 * Detects whether a validation structure (Business Rule Task →  XOR gateway →
 * Error End Event) is already wired immediately after the given start event.
 *
 * Returns `{ businessRuleTaskId, decisionId }` on success, or `null` if no
 * validation structure is found.
 */
export function findValidationStructure(
	defs: BpmnDefinitions,
	startEventId: string,
): ValidationStructure | null {
	const process = findProcessFor(defs, startEventId)
	if (!process) return null

	for (const flow of process.sequenceFlows) {
		if (flow.sourceRef !== startEventId) continue
		const target = process.flowElements.find((e) => e.id === flow.targetRef)
		if (!target || target.type !== "businessRuleTask") continue
		const ext = getZeebeExtensions(target.extensionElements)
		if (ext.calledDecision?.resultVariable !== "validationErrors") continue
		return { businessRuleTaskId: target.id, decisionId: ext.calledDecision.decisionId }
	}

	return null
}

// ── BPMN structure insertion ──────────────────────────────────────────────────

/** Standard element dimensions used when placing new validation elements. */
const SIZES = {
	event: { w: 36, h: 36 },
	task: { w: 100, h: 80 },
	gateway: { w: 50, h: 50 },
} as const

const H_GAP = 80
const V_GAP = 80

/**
 * Inserts the standard validation structure after a start event:
 *
 * ```
 * [Start Event] → [Business Rule Task] → [XOR Gateway]
 *                                             ├── = count(validationErrors) = 0 → [original next]
 *                                             └── (default) → [Error End Event: VALIDATION_FAILED]
 * ```
 *
 * If the start event has an existing outgoing flow, that flow is redirected to
 * originate from the XOR gateway (valid path) with the condition
 * `= count(validationErrors) = 0`. The start event now connects to the Business
 * Rule Task instead.
 *
 * If the start event has no outgoing flow the validation elements are inserted
 * with only the error path connected; the caller can wire the valid path later.
 *
 * @returns Updated `BpmnDefinitions` — the original is not mutated.
 */
export function insertValidationStructure(
	defs: BpmnDefinitions,
	startEventId: string,
	decisionId: string,
): BpmnDefinitions {
	const processIdx = defs.processes.findIndex((p) =>
		p.flowElements.some((e) => e.id === startEventId),
	)
	if (processIdx < 0) return defs

	const process = defs.processes[processIdx]!

	// ── Generate IDs ─────────────────────────────────────────────────────────
	const brtId = generateId("Activity")
	const gwId = generateId("Gateway")
	const errEndId = generateId("Event")
	const errorId = generateId("Error")

	const flowStartToBrt = generateId("Flow")
	const flowBrtToGw = generateId("Flow")
	const flowGwToError = generateId("Flow")

	// ── Find existing outgoing flow from start event ──────────────────────────
	const originalOutgoingFlowId = process.sequenceFlows.find(
		(f) => f.sourceRef === startEventId,
	)?.id

	// ── Build new flow elements ───────────────────────────────────────────────
	const brt: BpmnBusinessRuleTask = {
		type: "businessRuleTask",
		id: brtId,
		name: "Validate Input",
		incoming: [flowStartToBrt],
		outgoing: [flowBrtToGw],
		extensionElements: zeebeExtensionsToXmlElements({
			calledDecision: { decisionId, resultVariable: "validationErrors" },
		}),
		unknownAttributes: {},
	}

	const gwOutgoing = [flowGwToError]
	if (originalOutgoingFlowId) gwOutgoing.unshift(originalOutgoingFlowId)

	const gateway: BpmnExclusiveGateway = {
		type: "exclusiveGateway",
		id: gwId,
		name: "Input valid?",
		default: flowGwToError,
		incoming: [flowBrtToGw],
		outgoing: gwOutgoing,
		extensionElements: [],
		unknownAttributes: {},
	}

	const errEnd: BpmnEndEvent = {
		type: "endEvent",
		id: errEndId,
		name: "Invalid Input",
		incoming: [flowGwToError],
		outgoing: [],
		eventDefinitions: [{ type: "error", errorRef: errorId }],
		extensionElements: [],
		unknownAttributes: {},
	}

	const errorDef: BpmnError = {
		id: errorId,
		name: "VALIDATION_FAILED",
		errorCode: "VALIDATION_FAILED",
	}

	// ── New sequence flows ────────────────────────────────────────────────────
	const newFlows: BpmnSequenceFlow[] = [
		{
			id: flowStartToBrt,
			sourceRef: startEventId,
			targetRef: brtId,
			extensionElements: [],
			unknownAttributes: {},
		},
		{
			id: flowBrtToGw,
			sourceRef: brtId,
			targetRef: gwId,
			extensionElements: [],
			unknownAttributes: {},
		},
		{
			id: flowGwToError,
			sourceRef: gwId,
			targetRef: errEndId,
			extensionElements: [],
			unknownAttributes: {},
		},
	]

	// ── Update start event outgoing list ──────────────────────────────────────
	const updatedElements = process.flowElements.map((el) => {
		if (el.id !== startEventId) return el
		const without = el.outgoing.filter((o) => o !== originalOutgoingFlowId)
		return { ...el, outgoing: [...without, flowStartToBrt] }
	})

	// ── Redirect original outgoing flow ───────────────────────────────────────
	const updatedFlows = process.sequenceFlows.map((f) => {
		if (f.id !== originalOutgoingFlowId) return f
		return {
			...f,
			sourceRef: gwId,
			conditionExpression: {
				text: "= count(validationErrors) = 0",
				attributes: {},
			},
		}
	})

	const newProcess = {
		...process,
		flowElements: [...updatedElements, brt, gateway, errEnd],
		sequenceFlows: [...updatedFlows, ...newFlows],
	}

	// ── DI: compute positions ─────────────────────────────────────────────────
	let updatedDefs: BpmnDefinitions = {
		...defs,
		errors: [...defs.errors, errorDef],
		processes: defs.processes.map((p, i) => (i === processIdx ? newProcess : p)),
	}
	updatedDefs = _insertValidationDi(updatedDefs, startEventId, {
		brtId,
		gwId,
		errEndId,
		flowStartToBrt,
		flowBrtToGw,
		flowGwToError,
		originalOutgoingFlowId,
	})

	return updatedDefs
}

/** Adds DI shapes and edges for the newly inserted validation elements. */
function _insertValidationDi(
	defs: BpmnDefinitions,
	startEventId: string,
	ids: {
		brtId: string
		gwId: string
		errEndId: string
		flowStartToBrt: string
		flowBrtToGw: string
		flowGwToError: string
		originalOutgoingFlowId: string | undefined
	},
): BpmnDefinitions {
	if (!defs.diagrams[0]) return defs

	const plane = defs.diagrams[0].plane
	const startShape = plane.shapes.find((s) => s.bpmnElement === startEventId)

	// Default position if no DI exists for the start event
	const sx = startShape?.bounds.x ?? 152
	const sy = startShape?.bounds.y ?? 202
	const sw = SIZES.event.w
	const sh = SIZES.event.h
	// Vertical center of start event
	const centerY = sy + sh / 2

	// Positions (top-left corner of each element)
	const brtX = sx + sw + H_GAP
	const brtY = centerY - SIZES.task.h / 2
	const gwX = brtX + SIZES.task.w + H_GAP
	const gwY = centerY - SIZES.gateway.h / 2
	const errX = gwX + SIZES.gateway.w / 2 - SIZES.event.w / 2
	const errY = gwY + SIZES.gateway.h + V_GAP

	// Centers for waypoint computation
	const startCx = sx + sw / 2
	const startCy = centerY
	const brtCx = brtX + SIZES.task.w / 2
	const brtCy = centerY
	const gwCx = gwX + SIZES.gateway.w / 2
	const gwCy = centerY
	const errCx = errX + SIZES.event.w / 2
	const errCy = errY + SIZES.event.h / 2

	const newShapes: BpmnDiShape[] = [
		{
			id: generateId("Shape"),
			bpmnElement: ids.brtId,
			bounds: { x: brtX, y: brtY, width: SIZES.task.w, height: SIZES.task.h },
			unknownAttributes: {},
		},
		{
			id: generateId("Shape"),
			bpmnElement: ids.gwId,
			isMarkerVisible: true,
			bounds: { x: gwX, y: gwY, width: SIZES.gateway.w, height: SIZES.gateway.h },
			unknownAttributes: {},
		},
		{
			id: generateId("Shape"),
			bpmnElement: ids.errEndId,
			bounds: { x: errX, y: errY, width: SIZES.event.w, height: SIZES.event.h },
			unknownAttributes: {},
		},
	]

	const newEdges: BpmnDiEdge[] = [
		{
			id: generateId("Edge"),
			bpmnElement: ids.flowStartToBrt,
			waypoints: [
				{ x: startCx + sw / 2, y: startCy },
				{ x: brtX, y: brtCy },
			],
			unknownAttributes: {},
		},
		{
			id: generateId("Edge"),
			bpmnElement: ids.flowBrtToGw,
			waypoints: [
				{ x: brtX + SIZES.task.w, y: brtCy },
				{ x: gwX, y: gwCy },
			],
			unknownAttributes: {},
		},
		{
			id: generateId("Edge"),
			bpmnElement: ids.flowGwToError,
			waypoints: [
				{ x: gwCx, y: gwY + SIZES.gateway.h },
				{ x: errCx, y: errY },
			],
			unknownAttributes: {},
		},
	]

	// Update the redirected outgoing flow edge to start from the gateway
	const updatedEdges = plane.edges.map((e) => {
		if (e.bpmnElement !== ids.originalOutgoingFlowId) return e
		const firstWp = e.waypoints[0]
		const rest = e.waypoints.slice(1)
		return {
			...e,
			waypoints: [
				// Replace first waypoint with gateway right-edge
				{ x: gwX + SIZES.gateway.w, y: gwCy },
				...(firstWp ? rest : []),
			],
		}
	})

	const updatedPlane = {
		...plane,
		shapes: [...plane.shapes, ...newShapes],
		edges: [...updatedEdges, ...newEdges],
	}

	return {
		...defs,
		diagrams: [
			{
				...defs.diagrams[0],
				plane: updatedPlane,
			},
			...defs.diagrams.slice(1),
		],
	}
}

// ── BPMN structure removal ────────────────────────────────────────────────────

/**
 * Removes the validation structure wired after the given start event, if any.
 *
 * Restores the start event's outgoing connection to the element that the XOR
 * gateway's valid path was pointing to. The generated error definition is also
 * removed from `defs.errors`.
 *
 * @returns Updated `BpmnDefinitions` — the original is not mutated.
 */
export function removeValidationStructure(
	defs: BpmnDefinitions,
	startEventId: string,
): BpmnDefinitions {
	const processIdx = defs.processes.findIndex((p) =>
		p.flowElements.some((e) => e.id === startEventId),
	)
	if (processIdx < 0) return defs

	const process = defs.processes[processIdx]!

	// Locate the BRT immediately after the start event
	const startToBrtFlow = process.sequenceFlows.find((f) => f.sourceRef === startEventId)
	if (!startToBrtFlow) return defs

	const brt = process.flowElements.find(
		(e) => e.id === startToBrtFlow.targetRef && e.type === "businessRuleTask",
	)
	if (!brt) return defs
	const ext = getZeebeExtensions(brt.extensionElements)
	if (ext.calledDecision?.resultVariable !== "validationErrors") return defs

	// BRT → gateway
	const brtToGwFlow = process.sequenceFlows.find((f) => f.sourceRef === brt.id)
	const gateway = brtToGwFlow
		? process.flowElements.find(
				(e) => e.id === brtToGwFlow.targetRef && e.type === "exclusiveGateway",
			)
		: undefined
	if (!gateway || gateway.type !== "exclusiveGateway") return defs

	// Gateway → error end event (default/no-condition flow)
	const gwFlows = process.sequenceFlows.filter((f) => f.sourceRef === gateway.id)
	const errorFlow = gwFlows.find((f) => !f.conditionExpression)
	const validFlow = gwFlows.find((f) => f.conditionExpression)

	const errEnd = errorFlow
		? process.flowElements.find((e) => e.id === errorFlow.targetRef && e.type === "endEvent")
		: undefined

	// Collect IDs to remove
	const removeElementIds = new Set([brt.id, gateway.id, ...(errEnd ? [errEnd.id] : [])])
	const removeFlowIds = new Set([
		startToBrtFlow.id,
		...(brtToGwFlow ? [brtToGwFlow.id] : []),
		...(errorFlow ? [errorFlow.id] : []),
	])

	// Find error ref to remove from defs.errors
	const errEndEl = errEnd?.type === "endEvent" ? errEnd : undefined
	const errorRefId = errEndEl?.eventDefinitions[0]?.type === "error"
		? errEndEl.eventDefinitions[0].errorRef
		: undefined

	// Reconnect: restore the valid-path flow to come from the start event
	const updatedFlows = process.sequenceFlows
		.filter((f) => !removeFlowIds.has(f.id))
		.map((f) => {
			if (f.id !== validFlow?.id) return f
			return { ...f, sourceRef: startEventId, conditionExpression: undefined }
		})

	// Restore start event outgoing list
	const updatedElements = process.flowElements
		.filter((e) => !removeElementIds.has(e.id))
		.map((el) => {
			if (el.id !== startEventId) return el
			const without = el.outgoing.filter((o) => o !== startToBrtFlow.id)
			const restored = validFlow ? [validFlow.id, ...without] : without
			return { ...el, outgoing: restored }
		})

	const newProcess = {
		...process,
		flowElements: updatedElements,
		sequenceFlows: updatedFlows,
	}

	// Remove DI shapes and edges for removed elements
	let updatedDefs: BpmnDefinitions = {
		...defs,
		errors: errorRefId ? defs.errors.filter((e) => e.id !== errorRefId) : defs.errors,
		processes: defs.processes.map((p, i) => (i === processIdx ? newProcess : p)),
	}
	updatedDefs = _removeValidationDi(updatedDefs, removeElementIds, removeFlowIds, validFlow?.id)

	return updatedDefs
}

function _removeValidationDi(
	defs: BpmnDefinitions,
	removeElementIds: Set<string>,
	removeFlowIds: Set<string>,
	restoredFlowId: string | undefined,
): BpmnDefinitions {
	if (!defs.diagrams[0]) return defs

	const plane = defs.diagrams[0].plane

	const updatedShapes = plane.shapes.filter((s) => !removeElementIds.has(s.bpmnElement))
	const updatedEdges = plane.edges
		.filter((e) => !removeFlowIds.has(e.bpmnElement))
		.map((e) => {
			// The restored flow's edge now starts from the start event again.
			// We don't know the start event's exact right-edge position here, but
			// leaving the waypoints as-is is acceptable — auto-layout can fix them.
			if (e.bpmnElement !== restoredFlowId) return e
			return e // leave waypoints unchanged; user can re-layout
		})

	return {
		...defs,
		diagrams: [
			{
				...defs.diagrams[0],
				plane: { ...plane, shapes: updatedShapes, edges: updatedEdges },
			},
			...defs.diagrams.slice(1),
		],
	}
}

// ── DMN variable name extraction ──────────────────────────────────────────────

/**
 * Parses a validation DMN XML and returns the input column expression names.
 * Used by the Process Runner to display expected variable hints.
 *
 * Returns an empty array on any parse error.
 */
export function getValidationInputNames(dmnXml: string): string[] {
	try {
		const defs = parseDmn(dmnXml)
		const decision = defs.decisions[0]
		if (!decision?.decisionTable) return []
		return decision.decisionTable.inputs.map((i) => i.inputExpression.text ?? "").filter(Boolean)
	} catch {
		return []
	}
}
