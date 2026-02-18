import type { BpmnElementType, BpmnFlowElement } from "../bpmn/bpmn-model.js";
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
		const layer = orderedLayers[layerIdx]!;
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
		const layer = orderedLayers[layerIdx]!;
		const layerX = layerXOffsets[layerIdx]!;

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
			const nodeId = layer[posIdx]!;
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
		const layer = orderedLayers[i]!;
		const layerHeight = layerHeights[i]!;
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
		const prevLayer = orderedLayers[i - 1]!;
		const currLayer = orderedLayers[i]!;

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
				for (const id of orderedLayers[j]!) {
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
