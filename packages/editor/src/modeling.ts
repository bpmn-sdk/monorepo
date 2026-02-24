import type {
	BpmnBounds,
	BpmnDefinitions,
	BpmnDiEdge,
	BpmnDiShape,
	BpmnFlowElement,
	BpmnSequenceFlow,
	BpmnWaypoint,
} from "@bpmn-sdk/core";
import { computeWaypoints, computeWaypointsWithPorts, portFromWaypoint } from "./geometry.js";
import { genId } from "./id.js";
import type { CreateShapeType, PortDir } from "./types.js";

// ── Empty definitions ─────────────────────────────────────────────────────────

/** Creates a minimal valid BpmnDefinitions with one process and one diagram. */
export function createEmptyDefinitions(): BpmnDefinitions {
	const processId = genId("Process");
	const planeId = genId("BPMNPlane");
	return {
		id: genId("Definitions"),
		targetNamespace: "http://bpmn.io/schema/bpmn",
		namespaces: {
			bpmn: "http://www.omg.org/spec/BPMN/20100524/MODEL",
			bpmndi: "http://www.omg.org/spec/BPMN/20100524/DI",
			dc: "http://www.omg.org/spec/DD/20100524/DC",
			di: "http://www.omg.org/spec/DD/20100524/DI",
		},
		unknownAttributes: {},
		errors: [],
		escalations: [],
		messages: [],
		collaborations: [],
		processes: [
			{
				id: processId,
				extensionElements: [],
				flowElements: [],
				sequenceFlows: [],
				textAnnotations: [],
				associations: [],
				unknownAttributes: {},
			},
		],
		diagrams: [
			{
				id: genId("BPMNDiagram"),
				plane: {
					id: planeId,
					bpmnElement: processId,
					shapes: [],
					edges: [],
				},
			},
		],
	};
}

// ── Helper: build a new flow element ─────────────────────────────────────────

function makeFlowElement(type: CreateShapeType, id: string, name?: string): BpmnFlowElement {
	const base = {
		id,
		name,
		incoming: [] as string[],
		outgoing: [] as string[],
		extensionElements: [] as never[],
		unknownAttributes: {} as Record<string, string>,
	};

	switch (type) {
		case "startEvent":
			return { ...base, type: "startEvent", eventDefinitions: [] };
		case "endEvent":
			return { ...base, type: "endEvent", eventDefinitions: [] };
		case "serviceTask":
			return { ...base, type: "serviceTask" };
		case "userTask":
			return { ...base, type: "userTask" };
		case "scriptTask":
			return { ...base, type: "scriptTask" };
		case "sendTask":
			return { ...base, type: "sendTask" };
		case "receiveTask":
			return { ...base, type: "receiveTask" };
		case "businessRuleTask":
			return { ...base, type: "businessRuleTask" };
		case "exclusiveGateway":
			return { ...base, type: "exclusiveGateway" };
		case "parallelGateway":
			return { ...base, type: "parallelGateway" };
		case "inclusiveGateway":
			return { ...base, type: "inclusiveGateway" };
		case "eventBasedGateway":
			return { ...base, type: "eventBasedGateway" };
	}
}

// ── Create shape ─────────────────────────────────────────────────────────────

export function createShape(
	defs: BpmnDefinitions,
	type: CreateShapeType,
	bounds: BpmnBounds,
	name?: string,
): { defs: BpmnDefinitions; id: string } {
	const id = genId(type);
	const shapeId = genId(`${type}_di`);
	const flowElement = makeFlowElement(type, id, name);

	const process = defs.processes[0];
	if (!process) return { defs, id };

	const diagram = defs.diagrams[0];
	if (!diagram) return { defs, id };

	const diShape: BpmnDiShape = {
		id: shapeId,
		bpmnElement: id,
		bounds,
		unknownAttributes: {},
	};

	const newDefs: BpmnDefinitions = {
		...defs,
		processes: [
			{
				...process,
				flowElements: [...process.flowElements, flowElement],
			},
			...defs.processes.slice(1),
		],
		diagrams: [
			{
				...diagram,
				plane: {
					...diagram.plane,
					shapes: [...diagram.plane.shapes, diShape],
				},
			},
			...defs.diagrams.slice(1),
		],
	};

	return { defs: newDefs, id };
}

// ── Create connection ─────────────────────────────────────────────────────────

export function createConnection(
	defs: BpmnDefinitions,
	sourceId: string,
	targetId: string,
	waypoints: BpmnWaypoint[],
): { defs: BpmnDefinitions; id: string } {
	const id = genId("Flow");
	const edgeId = genId("Flow_di");

	const process = defs.processes[0];
	if (!process) return { defs, id };

	const diagram = defs.diagrams[0];
	if (!diagram) return { defs, id };

	const sf: BpmnSequenceFlow = {
		id,
		sourceRef: sourceId,
		targetRef: targetId,
		extensionElements: [],
		unknownAttributes: {},
	};

	const edge: BpmnDiEdge = {
		id: edgeId,
		bpmnElement: id,
		waypoints,
		unknownAttributes: {},
	};

	// Update source.outgoing and target.incoming
	const updatedElements = process.flowElements.map((el) => {
		if (el.id === sourceId) {
			return { ...el, outgoing: [...el.outgoing, id] };
		}
		if (el.id === targetId) {
			return { ...el, incoming: [...el.incoming, id] };
		}
		return el;
	});

	const newDefs: BpmnDefinitions = {
		...defs,
		processes: [
			{
				...process,
				flowElements: updatedElements,
				sequenceFlows: [...process.sequenceFlows, sf],
			},
			...defs.processes.slice(1),
		],
		diagrams: [
			{
				...diagram,
				plane: {
					...diagram.plane,
					edges: [...diagram.plane.edges, edge],
				},
			},
			...defs.diagrams.slice(1),
		],
	};

	return { defs: newDefs, id };
}

// ── Move shapes ───────────────────────────────────────────────────────────────

export function moveShapes(
	defs: BpmnDefinitions,
	moves: Array<{ id: string; dx: number; dy: number }>,
): BpmnDefinitions {
	if (moves.length === 0) return defs;

	const moveMap = new Map(moves.map((m) => [m.id, m]));

	const process = defs.processes[0];
	const diagram = defs.diagrams[0];
	if (!process || !diagram) return defs;

	// Update DI shape bounds (and label bounds, if present)
	const newShapes = diagram.plane.shapes.map((s) => {
		const m = moveMap.get(s.bpmnElement);
		if (!m) return s;
		return {
			...s,
			bounds: {
				...s.bounds,
				x: s.bounds.x + m.dx,
				y: s.bounds.y + m.dy,
			},
			label:
				s.label?.bounds !== undefined
					? {
							...s.label,
							bounds: {
								x: s.label.bounds.x + m.dx,
								y: s.label.bounds.y + m.dy,
								width: s.label.bounds.width,
								height: s.label.bounds.height,
							},
						}
					: s.label,
		};
	});

	// Update edge waypoints
	// - If both source and target are moving: translate all waypoints by a consistent delta
	// - If only source is moving: translate first waypoint
	// - If only target is moving: translate last waypoint
	const newEdges = diagram.plane.edges.map((edge) => {
		const flow = process.sequenceFlows.find((sf) => sf.id === edge.bpmnElement);
		if (!flow) return edge;

		const srcMove = moveMap.get(flow.sourceRef);
		const tgtMove = moveMap.get(flow.targetRef);

		if (!srcMove && !tgtMove) return edge;
		if (edge.waypoints.length < 2) return edge;

		const newWps = [...edge.waypoints];
		if (srcMove && tgtMove) {
			// Both endpoints moving — translate all waypoints together
			return {
				...edge,
				waypoints: newWps.map((wp) => ({ x: wp.x + srcMove.dx, y: wp.y + srcMove.dy })),
			};
		}
		// Only one endpoint moves — preserve user-adjusted ports, recompute route
		const srcShape = newShapes.find((s) => s.bpmnElement === flow.sourceRef);
		const tgtShape = newShapes.find((s) => s.bpmnElement === flow.targetRef);
		if (srcShape && tgtShape) {
			const firstWp = newWps[0];
			const lastWp = newWps[newWps.length - 1];
			// Derive ports from pre-move bounds so user-adjusted exit/entry points are preserved
			const srcOldBounds = srcMove
				? {
						...srcShape.bounds,
						x: srcShape.bounds.x - srcMove.dx,
						y: srcShape.bounds.y - srcMove.dy,
					}
				: srcShape.bounds;
			const tgtOldBounds = tgtMove
				? {
						...tgtShape.bounds,
						x: tgtShape.bounds.x - tgtMove.dx,
						y: tgtShape.bounds.y - tgtMove.dy,
					}
				: tgtShape.bounds;
			const srcPort = firstWp ? portFromWaypoint(firstWp, srcOldBounds) : "right";
			const tgtPort = lastWp ? portFromWaypoint(lastWp, tgtOldBounds) : "left";
			return {
				...edge,
				waypoints: computeWaypointsWithPorts(srcShape.bounds, srcPort, tgtShape.bounds, tgtPort),
			};
		}
		return edge;
	});

	return {
		...defs,
		diagrams: [
			{
				...diagram,
				plane: { ...diagram.plane, shapes: newShapes, edges: newEdges },
			},
			...defs.diagrams.slice(1),
		],
	};
}

// ── Resize shape ──────────────────────────────────────────────────────────────

export function resizeShape(
	defs: BpmnDefinitions,
	id: string,
	newBounds: BpmnBounds,
): BpmnDefinitions {
	const process = defs.processes[0];
	const diagram = defs.diagrams[0];
	if (!process || !diagram) return defs;

	const newShapes = diagram.plane.shapes.map((s) =>
		s.bpmnElement === id ? { ...s, bounds: newBounds } : s,
	);

	// Recompute terminal waypoints for connected edges
	const newEdges = diagram.plane.edges.map((edge) => {
		const flow = process.sequenceFlows.find((sf) => sf.id === edge.bpmnElement);
		if (!flow) return edge;

		const isSource = flow.sourceRef === id;
		const isTarget = flow.targetRef === id;
		if (!isSource && !isTarget) return edge;

		// Find the other shape's bounds
		const otherId = isSource ? flow.targetRef : flow.sourceRef;
		const otherShape = diagram.plane.shapes.find((s) => s.bpmnElement === otherId);
		if (!otherShape) return edge;

		const wps = isSource
			? computeWaypoints(newBounds, otherShape.bounds)
			: computeWaypoints(otherShape.bounds, newBounds);

		return { ...edge, waypoints: wps };
	});

	return {
		...defs,
		diagrams: [
			{
				...diagram,
				plane: { ...diagram.plane, shapes: newShapes, edges: newEdges },
			},
			...defs.diagrams.slice(1),
		],
	};
}

// ── Delete elements ───────────────────────────────────────────────────────────

export function deleteElements(defs: BpmnDefinitions, ids: string[]): BpmnDefinitions {
	if (ids.length === 0) return defs;

	const idSet = new Set(ids);

	const process = defs.processes[0];
	const diagram = defs.diagrams[0];
	if (!process || !diagram) return defs;

	// Find sequence flows to remove (directly specified, or whose source/target is deleted)
	const flowsToRemove = new Set(
		process.sequenceFlows
			.filter((sf) => idSet.has(sf.id) || idSet.has(sf.sourceRef) || idSet.has(sf.targetRef))
			.map((sf) => sf.id),
	);

	// All IDs to remove from DI (shapes + edges)
	const allRemovedIds = new Set([...ids, ...flowsToRemove]);

	// Remove from process.flowElements and clean up incoming/outgoing
	const newFlowElements = process.flowElements
		.filter((el) => !idSet.has(el.id))
		.map((el) => ({
			...el,
			incoming: el.incoming.filter((ref) => !allRemovedIds.has(ref)),
			outgoing: el.outgoing.filter((ref) => !allRemovedIds.has(ref)),
		}));

	// Remove from process.sequenceFlows
	const newSequenceFlows = process.sequenceFlows.filter((sf) => !flowsToRemove.has(sf.id));

	// Remove DI shapes and edges
	const newDiShapes = diagram.plane.shapes.filter((s) => !idSet.has(s.bpmnElement));
	const newDiEdges = diagram.plane.edges.filter((e) => !allRemovedIds.has(e.bpmnElement));

	return {
		...defs,
		processes: [
			{
				...process,
				flowElements: newFlowElements,
				sequenceFlows: newSequenceFlows,
			},
			...defs.processes.slice(1),
		],
		diagrams: [
			{
				...diagram,
				plane: { ...diagram.plane, shapes: newDiShapes, edges: newDiEdges },
			},
			...defs.diagrams.slice(1),
		],
	};
}

// ── Update label ──────────────────────────────────────────────────────────────

export function updateLabel(defs: BpmnDefinitions, id: string, name: string): BpmnDefinitions {
	const process = defs.processes[0];
	if (!process) return defs;

	// Check flow elements first
	const elIndex = process.flowElements.findIndex((el) => el.id === id);
	if (elIndex >= 0) {
		const newElements = [...process.flowElements];
		const el = newElements[elIndex];
		if (el) {
			newElements[elIndex] = { ...el, name };
		}
		return {
			...defs,
			processes: [{ ...process, flowElements: newElements }, ...defs.processes.slice(1)],
		};
	}

	// Check sequence flows
	const sfIndex = process.sequenceFlows.findIndex((sf) => sf.id === id);
	if (sfIndex >= 0) {
		const newFlows = [...process.sequenceFlows];
		const sf = newFlows[sfIndex];
		if (sf) {
			newFlows[sfIndex] = { ...sf, name };
		}
		return {
			...defs,
			processes: [{ ...process, sequenceFlows: newFlows }, ...defs.processes.slice(1)],
		};
	}

	return defs;
}

// ── Update label position ─────────────────────────────────────────────────────

/** Updates the DI label bounds for a shape (sets explicit external label position). */
export function updateLabelPosition(
	defs: BpmnDefinitions,
	shapeId: string,
	labelBounds: BpmnBounds,
): BpmnDefinitions {
	const diagram = defs.diagrams[0];
	if (!diagram) return defs;

	const newShapes = diagram.plane.shapes.map((s) =>
		s.bpmnElement === shapeId ? { ...s, label: { bounds: labelBounds } } : s,
	);

	return {
		...defs,
		diagrams: [
			{ ...diagram, plane: { ...diagram.plane, shapes: newShapes } },
			...defs.diagrams.slice(1),
		],
	};
}

// ── Update edge endpoint ──────────────────────────────────────────────────────

/**
 * Reconnects one endpoint of an edge to a different port on the same
 * source or target shape, recomputing the orthogonal route.
 */
export function updateEdgeEndpoint(
	defs: BpmnDefinitions,
	edgeId: string,
	isStart: boolean,
	newPort: PortDir,
): BpmnDefinitions {
	const process = defs.processes[0];
	const diagram = defs.diagrams[0];
	if (!process || !diagram) return defs;

	const edge = diagram.plane.edges.find((e) => e.bpmnElement === edgeId);
	if (!edge || edge.waypoints.length < 2) return defs;

	const flow = process.sequenceFlows.find((sf) => sf.id === edgeId);
	if (!flow) return defs;

	const srcShape = diagram.plane.shapes.find((s) => s.bpmnElement === flow.sourceRef);
	const tgtShape = diagram.plane.shapes.find((s) => s.bpmnElement === flow.targetRef);
	if (!srcShape || !tgtShape) return defs;

	const first = edge.waypoints[0];
	const last = edge.waypoints[edge.waypoints.length - 1];
	if (!first || !last) return defs;

	const srcPort = isStart ? newPort : portFromWaypoint(first, srcShape.bounds);
	const tgtPort = isStart ? portFromWaypoint(last, tgtShape.bounds) : newPort;

	const newWaypoints = computeWaypointsWithPorts(
		srcShape.bounds,
		srcPort,
		tgtShape.bounds,
		tgtPort,
	);

	const newEdges = diagram.plane.edges.map((e) =>
		e.bpmnElement === edgeId ? { ...e, waypoints: newWaypoints } : e,
	);

	return {
		...defs,
		diagrams: [
			{ ...diagram, plane: { ...diagram.plane, edges: newEdges } },
			...defs.diagrams.slice(1),
		],
	};
}

// ── Change element type ───────────────────────────────────────────────────────

/**
 * Replaces a flow element's type while preserving its id, name, and connections.
 * Use this for gateway type-switching (exclusive ↔ parallel) and task type-switching.
 */
export function changeElementType(
	defs: BpmnDefinitions,
	id: string,
	newType: CreateShapeType,
): BpmnDefinitions {
	const process = defs.processes[0];
	if (!process) return defs;

	const elIndex = process.flowElements.findIndex((el) => el.id === id);
	if (elIndex < 0) return defs;
	const el = process.flowElements[elIndex];
	if (!el) return defs;

	const base = {
		id: el.id,
		name: el.name,
		incoming: el.incoming,
		outgoing: el.outgoing,
		extensionElements: el.extensionElements,
		unknownAttributes: el.unknownAttributes,
	};

	let newEl: BpmnFlowElement;
	switch (newType) {
		case "startEvent":
			newEl = { ...base, type: "startEvent", eventDefinitions: [] };
			break;
		case "endEvent":
			newEl = { ...base, type: "endEvent", eventDefinitions: [] };
			break;
		case "serviceTask":
			newEl = { ...base, type: "serviceTask" };
			break;
		case "userTask":
			newEl = { ...base, type: "userTask" };
			break;
		case "scriptTask":
			newEl = { ...base, type: "scriptTask" };
			break;
		case "sendTask":
			newEl = { ...base, type: "sendTask" };
			break;
		case "receiveTask":
			newEl = { ...base, type: "receiveTask" };
			break;
		case "businessRuleTask":
			newEl = { ...base, type: "businessRuleTask" };
			break;
		case "exclusiveGateway":
			newEl = { ...base, type: "exclusiveGateway" };
			break;
		case "parallelGateway":
			newEl = { ...base, type: "parallelGateway" };
			break;
		case "inclusiveGateway":
			newEl = { ...base, type: "inclusiveGateway" };
			break;
		case "eventBasedGateway":
			newEl = { ...base, type: "eventBasedGateway" };
			break;
	}

	const newElements = [...process.flowElements];
	newElements[elIndex] = newEl;

	return {
		...defs,
		processes: [{ ...process, flowElements: newElements }, ...defs.processes.slice(1)],
	};
}

// ── Insert shape on edge ──────────────────────────────────────────────────────

/**
 * Splits an existing sequence flow by inserting a shape between its source and
 * target: removes the original edge and creates two new connections
 * (source → shapeId and shapeId → target).
 */
export function insertShapeOnEdge(
	defs: BpmnDefinitions,
	edgeId: string,
	shapeId: string,
): BpmnDefinitions {
	const process = defs.processes[0];
	const diagram = defs.diagrams[0];
	if (!process || !diagram) return defs;

	const flow = process.sequenceFlows.find((sf) => sf.id === edgeId);
	if (!flow) return defs;

	const srcDi = diagram.plane.shapes.find((s) => s.bpmnElement === flow.sourceRef);
	const tgtDi = diagram.plane.shapes.find((s) => s.bpmnElement === flow.targetRef);
	const newDi = diagram.plane.shapes.find((s) => s.bpmnElement === shapeId);
	if (!srcDi || !tgtDi || !newDi) return defs;

	const withoutEdge = deleteElements(defs, [edgeId]);
	const r1 = createConnection(
		withoutEdge,
		flow.sourceRef,
		shapeId,
		computeWaypoints(srcDi.bounds, newDi.bounds),
	);
	const r2 = createConnection(
		r1.defs,
		shapeId,
		flow.targetRef,
		computeWaypoints(newDi.bounds, tgtDi.bounds),
	);
	return r2.defs;
}

// ── Copy / paste ──────────────────────────────────────────────────────────────

export interface Clipboard {
	elements: BpmnFlowElement[];
	flows: BpmnSequenceFlow[];
	shapes: BpmnDiShape[];
	edges: BpmnDiEdge[];
}

export function copyElements(defs: BpmnDefinitions, ids: string[]): Clipboard {
	const idSet = new Set(ids);

	const process = defs.processes[0];
	const diagram = defs.diagrams[0];
	if (!process || !diagram) {
		return { elements: [], flows: [], shapes: [], edges: [] };
	}

	const elements = process.flowElements.filter((el) => idSet.has(el.id));
	const flows = process.sequenceFlows.filter(
		(sf) => idSet.has(sf.sourceRef) && idSet.has(sf.targetRef),
	);
	const flowIds = new Set(flows.map((sf) => sf.id));
	const shapes = diagram.plane.shapes.filter((s) => idSet.has(s.bpmnElement));
	const edges = diagram.plane.edges.filter((e) => flowIds.has(e.bpmnElement));

	return { elements, flows, shapes, edges };
}

export function pasteElements(
	defs: BpmnDefinitions,
	clipboard: Clipboard,
	offsetX: number,
	offsetY: number,
): { defs: BpmnDefinitions; newIds: Map<string, string> } {
	const newIds = new Map<string, string>();

	// Generate new IDs for elements
	for (const el of clipboard.elements) {
		newIds.set(el.id, genId(el.type));
	}
	for (const sf of clipboard.flows) {
		newIds.set(sf.id, genId("Flow"));
	}

	const process = defs.processes[0];
	const diagram = defs.diagrams[0];
	if (!process || !diagram) return { defs, newIds };

	// Create new flow elements with new IDs, offset positions handled via DI
	const newElements: BpmnFlowElement[] = clipboard.elements.map((el) => {
		const newId = newIds.get(el.id) ?? genId(el.type);
		const newIncoming = el.incoming
			.map((ref) => newIds.get(ref))
			.filter((r): r is string => r !== undefined);
		const newOutgoing = el.outgoing
			.map((ref) => newIds.get(ref))
			.filter((r): r is string => r !== undefined);
		return { ...el, id: newId, incoming: newIncoming, outgoing: newOutgoing };
	});

	// Create new sequence flows
	const newFlows: BpmnSequenceFlow[] = clipboard.flows.map((sf) => {
		const newId = newIds.get(sf.id) ?? genId("Flow");
		const newSrc = newIds.get(sf.sourceRef) ?? sf.sourceRef;
		const newTgt = newIds.get(sf.targetRef) ?? sf.targetRef;
		return { ...sf, id: newId, sourceRef: newSrc, targetRef: newTgt };
	});

	// Create new DI shapes with offset
	const newDiShapes: BpmnDiShape[] = clipboard.shapes.map((s) => {
		const newElId = newIds.get(s.bpmnElement) ?? s.bpmnElement;
		return {
			...s,
			id: genId(`${newElId}_di`),
			bpmnElement: newElId,
			bounds: {
				...s.bounds,
				x: s.bounds.x + offsetX,
				y: s.bounds.y + offsetY,
			},
		};
	});

	// Create new DI edges with offset waypoints
	const newDiEdges: BpmnDiEdge[] = clipboard.edges.map((e) => {
		const newFlowId = newIds.get(e.bpmnElement) ?? e.bpmnElement;
		return {
			...e,
			id: genId(`${newFlowId}_di`),
			bpmnElement: newFlowId,
			waypoints: e.waypoints.map((wp) => ({
				x: wp.x + offsetX,
				y: wp.y + offsetY,
			})),
		};
	});

	const newDefs: BpmnDefinitions = {
		...defs,
		processes: [
			{
				...process,
				flowElements: [...process.flowElements, ...newElements],
				sequenceFlows: [...process.sequenceFlows, ...newFlows],
			},
			...defs.processes.slice(1),
		],
		diagrams: [
			{
				...diagram,
				plane: {
					...diagram.plane,
					shapes: [...diagram.plane.shapes, ...newDiShapes],
					edges: [...diagram.plane.edges, ...newDiEdges],
				},
			},
			...defs.diagrams.slice(1),
		],
	};

	return { defs: newDefs, newIds };
}
