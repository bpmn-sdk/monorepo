import type { BpmnSequenceFlow } from "../bpmn/bpmn-model.js";
import type { BackEdge } from "./graph.js";
import { LABEL_CHAR_WIDTH, LABEL_HEIGHT, LABEL_MIN_WIDTH, LABEL_VERTICAL_OFFSET } from "./types.js";
import type { Bounds, LayoutEdge, LayoutNode, Waypoint } from "./types.js";

/** Port side for gateway edge connection. */
export type PortSide = "right" | "top" | "bottom";

const GATEWAY_TYPES: ReadonlySet<string> = new Set([
	"exclusiveGateway",
	"parallelGateway",
	"inclusiveGateway",
	"eventBasedGateway",
]);

/**
 * Assign source ports for outgoing edges of a gateway.
 * - Single output: right port.
 * - Odd count: middle (by target y) → right, upper half → top, lower half → bottom.
 * - Even count: upper half → top, lower half → bottom, no right port.
 */
export function assignGatewayPorts(
	outgoingFlows: BpmnSequenceFlow[],
	nodeMap: Map<string, LayoutNode>,
): Map<string, PortSide> {
	const portMap = new Map<string, PortSide>();
	const count = outgoingFlows.length;

	if (count === 0) return portMap;
	if (count === 1) {
		const first = outgoingFlows[0];
		if (first) portMap.set(first.id, "right");
		return portMap;
	}

	// Sort flows by target's center-y (ascending = topmost first)
	const sorted = [...outgoingFlows].sort((a, b) => {
		const targetA = nodeMap.get(a.targetRef);
		const targetB = nodeMap.get(b.targetRef);
		const yA = targetA ? targetA.bounds.y + targetA.bounds.height / 2 : 0;
		const yB = targetB ? targetB.bounds.y + targetB.bounds.height / 2 : 0;
		return yA - yB;
	});

	if (count % 2 === 1) {
		const midIndex = Math.floor(count / 2);
		for (let i = 0; i < sorted.length; i++) {
			const flow = sorted[i];
			if (!flow) continue;
			if (i < midIndex) {
				portMap.set(flow.id, "top");
			} else if (i === midIndex) {
				portMap.set(flow.id, "right");
			} else {
				portMap.set(flow.id, "bottom");
			}
		}
	} else {
		const midIndex = count / 2;
		for (let i = 0; i < sorted.length; i++) {
			const flow = sorted[i];
			if (!flow) continue;
			portMap.set(flow.id, i < midIndex ? "top" : "bottom");
		}
	}

	return portMap;
}

/**
 * Route edges with orthogonal (horizontal + vertical) segments.
 * Forward edges go left-to-right; back-edges route above or below.
 * Gateway sources use port-based routing (top/right/bottom).
 */
export function routeEdges(
	sequenceFlows: BpmnSequenceFlow[],
	nodeMap: Map<string, LayoutNode>,
	backEdges: BackEdge[],
): LayoutEdge[] {
	const backEdgeIds = new Set(backEdges.map((be) => be.flowId));

	// Group forward flows by source for gateway port assignment
	const forwardFlowsBySource = new Map<string, BpmnSequenceFlow[]>();
	for (const flow of sequenceFlows) {
		if (backEdgeIds.has(flow.id)) continue;
		let bucket = forwardFlowsBySource.get(flow.sourceRef);
		if (!bucket) {
			bucket = [];
			forwardFlowsBySource.set(flow.sourceRef, bucket);
		}
		bucket.push(flow);
	}

	// Assign ports for gateway sources
	const portAssignments = new Map<string, PortSide>();
	for (const [sourceId, flows] of forwardFlowsBySource) {
		const source = nodeMap.get(sourceId);
		if (!source || !GATEWAY_TYPES.has(source.type)) continue;
		const ports = assignGatewayPorts(flows, nodeMap);
		for (const [flowId, port] of ports) {
			portAssignments.set(flowId, port);
		}
	}

	const edges: LayoutEdge[] = [];

	for (const flow of sequenceFlows) {
		const source = nodeMap.get(flow.sourceRef);
		const target = nodeMap.get(flow.targetRef);
		if (!source || !target) continue;

		const isBackEdge = backEdgeIds.has(flow.id);
		let waypoints: Waypoint[];

		if (isBackEdge) {
			waypoints = routeBackEdge(source, target, nodeMap);
		} else {
			const port = portAssignments.get(flow.id);
			waypoints = port ? routeFromPort(source, target, port) : routeForwardEdge(source, target);
		}

		const labelBounds = flow.name ? computeEdgeLabelBounds(waypoints, flow.name) : undefined;

		edges.push({
			id: flow.id,
			sourceRef: flow.sourceRef,
			targetRef: flow.targetRef,
			waypoints,
			label: flow.name,
			labelBounds,
		});
	}

	return edges;
}

/** Route a forward edge with orthogonal segments. */
function routeForwardEdge(source: LayoutNode, target: LayoutNode): Waypoint[] {
	const sourceRight = source.bounds.x + source.bounds.width;
	const sourceCenterY = source.bounds.y + source.bounds.height / 2;
	const targetLeft = target.bounds.x;
	const targetCenterY = target.bounds.y + target.bounds.height / 2;

	// Same vertical position: straight horizontal line
	if (Math.abs(sourceCenterY - targetCenterY) < 1) {
		return [
			{ x: sourceRight, y: sourceCenterY },
			{ x: targetLeft, y: targetCenterY },
		];
	}

	// Different vertical positions: L-shaped or Z-shaped routing
	const midX = (sourceRight + targetLeft) / 2;
	return [
		{ x: sourceRight, y: sourceCenterY },
		{ x: midX, y: sourceCenterY },
		{ x: midX, y: targetCenterY },
		{ x: targetLeft, y: targetCenterY },
	];
}

/** Route a forward edge from a specific port side on the source node. */
function routeFromPort(source: LayoutNode, target: LayoutNode, port: PortSide): Waypoint[] {
	if (port === "right") {
		return routeForwardEdge(source, target);
	}

	const sourceRight = source.bounds.x + source.bounds.width;
	const targetLeft = target.bounds.x;
	const targetCenterY = target.bounds.y + target.bounds.height / 2;

	const srcX = source.bounds.x + source.bounds.width / 2;
	const srcY = port === "top" ? source.bounds.y : source.bounds.y + source.bounds.height;

	// Same vertical position as target: straight horizontal
	if (Math.abs(srcY - targetCenterY) < 1) {
		return [
			{ x: srcX, y: srcY },
			{ x: targetLeft, y: targetCenterY },
		];
	}

	// Z-shaped: horizontal to midpoint column, vertical to target Y, horizontal to target.
	// Keeps the vertical segment away from the gateway's column to avoid crossing nearby elements.
	const midX = (sourceRight + targetLeft) / 2;
	return [
		{ x: srcX, y: srcY },
		{ x: midX, y: srcY },
		{ x: midX, y: targetCenterY },
		{ x: targetLeft, y: targetCenterY },
	];
}

/**
 * Route a back-edge (loop) above all nodes.
 * Goes: source right → up → left → down → target left
 */
function routeBackEdge(
	source: LayoutNode,
	target: LayoutNode,
	nodeMap: Map<string, LayoutNode>,
): Waypoint[] {
	// Find the topmost y coordinate of all nodes to route above
	let minY = Number.POSITIVE_INFINITY;
	for (const node of nodeMap.values()) {
		const top = node.bounds.y - (node.labelBounds ? node.labelBounds.height + 8 : 0);
		if (top < minY) minY = top;
	}

	const routeY = minY - 30;

	const sourceRight = source.bounds.x + source.bounds.width;
	const sourceCenterY = source.bounds.y + source.bounds.height / 2;
	const targetLeft = target.bounds.x;
	const targetCenterY = target.bounds.y + target.bounds.height / 2;

	return [
		{ x: sourceRight, y: sourceCenterY },
		{ x: sourceRight + 20, y: sourceCenterY },
		{ x: sourceRight + 20, y: routeY },
		{ x: targetLeft - 20, y: routeY },
		{ x: targetLeft - 20, y: targetCenterY },
		{ x: targetLeft, y: targetCenterY },
	];
}

/** Compute label bounds centered above the midpoint of an edge. */
function computeEdgeLabelBounds(waypoints: Waypoint[], label: string): Bounds {
	const midIdx = Math.floor(waypoints.length / 2);
	const midPoint = waypoints[midIdx];
	if (!midPoint) return { x: 0, y: 0, width: 0, height: 0 };

	// If there's a segment, use the midpoint of that segment
	let labelX = midPoint.x;
	let labelY = midPoint.y;
	if (midIdx > 0) {
		const prevPoint = waypoints[midIdx - 1];
		if (!prevPoint) return { x: 0, y: 0, width: 0, height: 0 };
		labelX = (prevPoint.x + midPoint.x) / 2;
		labelY = (prevPoint.y + midPoint.y) / 2;
	}

	const labelWidth = Math.max(label.length * LABEL_CHAR_WIDTH, LABEL_MIN_WIDTH);
	const labelHeight = LABEL_HEIGHT;

	return {
		x: labelX - labelWidth / 2,
		y: labelY - labelHeight - LABEL_VERTICAL_OFFSET,
		width: labelWidth,
		height: labelHeight,
	};
}
