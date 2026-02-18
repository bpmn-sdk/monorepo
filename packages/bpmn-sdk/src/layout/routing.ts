import type { BpmnSequenceFlow } from "../bpmn/bpmn-model.js";
import type { BackEdge } from "./graph.js";
import type { Bounds, LayoutEdge, LayoutNode, Waypoint } from "./types.js";

/**
 * Route edges with orthogonal (horizontal + vertical) segments.
 * Forward edges go left-to-right; back-edges route above or below.
 */
export function routeEdges(
	sequenceFlows: BpmnSequenceFlow[],
	nodeMap: Map<string, LayoutNode>,
	backEdges: BackEdge[],
): LayoutEdge[] {
	const backEdgeIds = new Set(backEdges.map((be) => be.flowId));
	const edges: LayoutEdge[] = [];

	for (const flow of sequenceFlows) {
		const source = nodeMap.get(flow.sourceRef);
		const target = nodeMap.get(flow.targetRef);
		if (!source || !target) continue;

		const isBackEdge = backEdgeIds.has(flow.id);
		const waypoints = isBackEdge
			? routeBackEdge(source, target, nodeMap)
			: routeForwardEdge(source, target);

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

	const labelWidth = Math.max(label.length * 7, 40);
	const labelHeight = 14;

	return {
		x: labelX - labelWidth / 2,
		y: labelY - labelHeight - 10,
		width: labelWidth,
		height: labelHeight,
	};
}
