import type { BpmnElementType, BpmnFlowElement } from "../bpmn/bpmn-model.js";
import type { DirectedGraph } from "./graph.js";
import type { Bounds, LayoutNode } from "./types.js";
import { ELEMENT_SIZES, HORIZONTAL_SPACING, VERTICAL_SPACING } from "./types.js";

/** Get the fixed size for a BPMN element type. */
export function getElementSize(type: BpmnElementType): { width: number; height: number } {
	return ELEMENT_SIZES[type] ?? { width: 100, height: 80 };
}

/**
 * Assign x,y coordinates to all nodes based on their layer and position.
 * Layout flows left-to-right: layers map to x-columns, positions map to y-rows.
 */
export function assignCoordinates(
	orderedLayers: string[][],
	nodeIndex: Map<string, BpmnFlowElement>,
): LayoutNode[] {
	const layoutNodes: LayoutNode[] = [];

	// Calculate x offset for each layer
	const layerXOffsets: number[] = [];
	let currentX = 0;

	for (let layerIdx = 0; layerIdx < orderedLayers.length; layerIdx++) {
		layerXOffsets.push(currentX);

		// Find the widest element in this layer
		let maxWidth = 0;
		const layer = orderedLayers[layerIdx];
		if (!layer) continue;
		for (const nodeId of layer) {
			const node = nodeIndex.get(nodeId);
			if (node) {
				const size = getElementSize(node.type);
				if (size.width > maxWidth) maxWidth = size.width;
			}
		}

		currentX += maxWidth + HORIZONTAL_SPACING;
	}

	// Calculate y offset for each node within its layer
	for (let layerIdx = 0; layerIdx < orderedLayers.length; layerIdx++) {
		const layer = orderedLayers[layerIdx];
		if (!layer) continue;
		const layerX = layerXOffsets[layerIdx];
		if (layerX === undefined) continue;

		// Find max height of elements in this layer for centering
		let maxWidth = 0;
		for (const nodeId of layer) {
			const node = nodeIndex.get(nodeId);
			if (node) {
				const size = getElementSize(node.type);
				if (size.width > maxWidth) maxWidth = size.width;
			}
		}

		let currentY = 0;
		for (let posIdx = 0; posIdx < layer.length; posIdx++) {
			const nodeId = layer[posIdx];
			if (!nodeId) continue;
			const node = nodeIndex.get(nodeId);
			if (!node) continue;

			const size = getElementSize(node.type);
			// Center smaller elements horizontally within the layer's column
			const xOffset = (maxWidth - size.width) / 2;

			const bounds: Bounds = {
				x: layerX + xOffset,
				y: currentY,
				width: size.width,
				height: size.height,
			};

			const labelBounds = computeLabelBounds(node, bounds);

			layoutNodes.push({
				id: nodeId,
				type: node.type,
				bounds,
				layer: layerIdx,
				position: posIdx,
				label: node.name,
				labelBounds,
			});

			currentY += size.height + VERTICAL_SPACING;
		}
	}

	// Center the layout vertically so all layers are balanced
	centerLayersVertically(layoutNodes, orderedLayers);

	return layoutNodes;
}

/**
 * Center each layer vertically around the midpoint of the tallest layer.
 */
function centerLayersVertically(nodes: LayoutNode[], orderedLayers: string[][]): void {
	// Find the total height of each layer
	const layerHeights: number[] = [];
	for (const layer of orderedLayers) {
		const layerNodes = nodes.filter((n) => layer.includes(n.id));
		if (layerNodes.length === 0) {
			layerHeights.push(0);
			continue;
		}
		const minY = Math.min(...layerNodes.map((n) => n.bounds.y));
		const maxY = Math.max(...layerNodes.map((n) => n.bounds.y + n.bounds.height));
		layerHeights.push(maxY - minY);
	}

	const maxHeight = Math.max(...layerHeights, 0);

	// Shift each layer so it's centered relative to the tallest layer
	for (let i = 0; i < orderedLayers.length; i++) {
		const layer = orderedLayers[i];
		if (!layer) continue;
		const layerHeight = layerHeights[i];
		if (layerHeight === undefined) continue;
		const yShift = (maxHeight - layerHeight) / 2;

		if (yShift > 0) {
			for (const node of nodes) {
				if (layer.includes(node.id)) {
					node.bounds.y += yShift;
					if (node.labelBounds) {
						node.labelBounds.y += yShift;
					}
				}
			}
		}
	}
}

/** Compute label bounds for a node based on its type. */
function computeLabelBounds(node: BpmnFlowElement, bounds: Bounds): Bounds | undefined {
	if (!node.name) return undefined;

	const labelWidth = Math.max(node.name.length * 7, 40);
	const labelHeight = 14;

	switch (node.type) {
		case "startEvent":
		case "endEvent":
		case "intermediateThrowEvent":
		case "intermediateCatchEvent":
			// Labels centered below events
			return {
				x: bounds.x + bounds.width / 2 - labelWidth / 2,
				y: bounds.y + bounds.height + 4,
				width: labelWidth,
				height: labelHeight,
			};
		case "exclusiveGateway":
		case "parallelGateway":
		case "inclusiveGateway":
		case "eventBasedGateway":
			// Labels centered above gateway diamonds
			return {
				x: bounds.x + bounds.width / 2 - labelWidth / 2,
				y: bounds.y - labelHeight - 4,
				width: labelWidth,
				height: labelHeight,
			};
		default:
			// Tasks/activities: labels centered inside — no separate label bounds needed
			return undefined;
	}
}

/**
 * Re-assign x-coordinates after sub-process expansion.
 * Walks layers left-to-right, shifting each layer to avoid overlap with the previous one.
 */
export function reassignXCoordinates(layoutNodes: LayoutNode[], orderedLayers: string[][]): void {
	const nodeMap = new Map<string, LayoutNode>();
	for (const n of layoutNodes) {
		nodeMap.set(n.id, n);
	}

	for (let i = 1; i < orderedLayers.length; i++) {
		const prevLayer = orderedLayers[i - 1];
		if (!prevLayer) continue;
		const currLayer = orderedLayers[i];
		if (!currLayer) continue;

		// Find the rightmost edge of the previous layer
		let prevMaxRight = 0;
		for (const id of prevLayer) {
			const n = nodeMap.get(id);
			if (n) {
				const right = n.bounds.x + n.bounds.width;
				if (right > prevMaxRight) prevMaxRight = right;
			}
		}

		// Find the leftmost edge of the current layer
		let currMinLeft = Number.POSITIVE_INFINITY;
		for (const id of currLayer) {
			const n = nodeMap.get(id);
			if (n && n.bounds.x < currMinLeft) currMinLeft = n.bounds.x;
		}

		const requiredX = prevMaxRight + HORIZONTAL_SPACING;
		const shift = requiredX - currMinLeft;
		if (shift > 0) {
			// Shift all nodes in this layer and subsequent layers
			for (let j = i; j < orderedLayers.length; j++) {
				for (const id of orderedLayers[j] ?? []) {
					const n = nodeMap.get(id);
					if (n) {
						n.bounds.x += shift;
						if (n.labelBounds) n.labelBounds.x += shift;
					}
				}
			}
		}
	}
}

const GATEWAY_TYPE_SET: ReadonlySet<string> = new Set([
	"exclusiveGateway",
	"parallelGateway",
	"inclusiveGateway",
	"eventBasedGateway",
]);

/**
 * Align nodes in linear sequences to a common y-baseline.
 * A "linear" node has ≤1 predecessor and ≤1 successor, and is not a gateway.
 * Walks forward from each chain root, setting successors to the same center-y.
 */
export function alignBranchBaselines(layoutNodes: LayoutNode[], dag: DirectedGraph): void {
	const nodeMap = new Map<string, LayoutNode>();
	for (const n of layoutNodes) {
		nodeMap.set(n.id, n);
	}

	const visited = new Set<string>();

	for (const n of layoutNodes) {
		if (visited.has(n.id)) continue;
		if (GATEWAY_TYPE_SET.has(n.type)) continue;

		// Walk backward to find the chain root
		let rootId = n.id;
		for (;;) {
			const preds = dag.predecessors.get(rootId) ?? [];
			if (preds.length !== 1) break;
			const pred = preds[0];
			if (!pred) break;
			const predNode = nodeMap.get(pred);
			if (!predNode || GATEWAY_TYPE_SET.has(predNode.type)) break;
			const predSuccs = dag.successors.get(pred) ?? [];
			if (predSuccs.length !== 1) break;
			rootId = pred;
		}

		// Walk forward from root, aligning to root's center-y
		const rootNode = nodeMap.get(rootId);
		if (!rootNode) continue;
		const baselineCenterY = rootNode.bounds.y + rootNode.bounds.height / 2;

		let currentId: string | undefined = rootId;
		while (currentId) {
			if (visited.has(currentId)) break;
			visited.add(currentId);

			const current = nodeMap.get(currentId);
			if (!current) break;
			if (GATEWAY_TYPE_SET.has(current.type)) break;

			const dy = baselineCenterY - (current.bounds.y + current.bounds.height / 2);
			if (Math.abs(dy) > 0.5) {
				current.bounds.y += dy;
				if (current.labelBounds) current.labelBounds.y += dy;
			}

			const succs: string[] = dag.successors.get(currentId) ?? [];
			if (succs.length !== 1) break;
			const nextId: string | undefined = succs[0];
			if (!nextId) break;
			const nextNode = nodeMap.get(nextId);
			if (!nextNode || GATEWAY_TYPE_SET.has(nextNode.type)) break;
			const nextPreds = dag.predecessors.get(nextId) ?? [];
			if (nextPreds.length !== 1) break;
			currentId = nextId;
		}
	}
}

/**
 * Align split/join gateway pairs to the same y-coordinate.
 * A split gateway fans out to multiple successors; the corresponding join gateway
 * is the nearest downstream gateway where all branches reconverge.
 */
export function alignSplitJoinPairs(layoutNodes: LayoutNode[], dag: DirectedGraph): void {
	const nodeMap = new Map<string, LayoutNode>();
	for (const n of layoutNodes) {
		nodeMap.set(n.id, n);
	}

	for (const n of layoutNodes) {
		if (!GATEWAY_TYPE_SET.has(n.type)) continue;
		const succs = dag.successors.get(n.id) ?? [];
		if (succs.length < 2) continue;

		// This is a split gateway — find its merge partner
		const joinId = findJoinGateway(n.id, dag, nodeMap);
		if (!joinId) continue;

		const joinNode = nodeMap.get(joinId);
		if (!joinNode) continue;

		// Force join gateway to same center-y as split gateway
		const splitCenterY = n.bounds.y + n.bounds.height / 2;
		const joinCenterY = joinNode.bounds.y + joinNode.bounds.height / 2;
		const dy = splitCenterY - joinCenterY;
		if (Math.abs(dy) > 0.5) {
			joinNode.bounds.y += dy;
			if (joinNode.labelBounds) joinNode.labelBounds.y += dy;
		}
	}
}

/**
 * Find the merge gateway for a given split gateway.
 * Walks forward from each successor until all paths converge at a common gateway.
 */
function findJoinGateway(
	splitId: string,
	dag: DirectedGraph,
	nodeMap: Map<string, LayoutNode>,
): string | undefined {
	const succs = dag.successors.get(splitId) ?? [];
	if (succs.length < 2) return undefined;

	// For each branch, walk forward to find the first downstream gateway
	const branchEndpoints = new Map<string, Set<string>>();

	for (const startId of succs) {
		const reachableGateways = new Set<string>();
		const queue = [startId];
		const seen = new Set<string>();

		while (queue.length > 0) {
			const id = queue.shift();
			if (!id || seen.has(id)) continue;
			seen.add(id);

			const node = nodeMap.get(id);
			if (!node) continue;

			if (GATEWAY_TYPE_SET.has(node.type) && id !== splitId) {
				reachableGateways.add(id);
				continue; // Don't traverse past gateways
			}

			for (const next of dag.successors.get(id) ?? []) {
				if (next !== splitId) queue.push(next);
			}
		}

		branchEndpoints.set(startId, reachableGateways);
	}

	// Find the gateway reachable from ALL branches
	const allBranches = [...branchEndpoints.values()];
	if (allBranches.length === 0) return undefined;

	const firstSet = allBranches[0];
	if (!firstSet) return undefined;

	for (const candidate of firstSet) {
		if (allBranches.every((s) => s.has(candidate))) {
			return candidate;
		}
	}

	return undefined;
}
