import type { BpmnFlowElement, BpmnProcess, BpmnSequenceFlow } from "../bpmn/bpmn-model.js";
import {
	alignBranchBaselines,
	alignSplitJoinPairs,
	assignCoordinates,
	reassignXCoordinates,
} from "./coordinates.js";
import { minimizeCrossings } from "./crossing.js";
import { buildGraph, detectBackEdges, reverseBackEdges } from "./graph.js";
import { assignLayers, groupByLayer } from "./layers.js";
import { assertNoOverlap } from "./overlap.js";
import { routeEdges } from "./routing.js";
import { layoutSubProcesses } from "./subprocess.js";
import type { LayoutNode, LayoutResult } from "./types.js";
/**
 * Auto-layout a BPMN process using the Sugiyama/layered algorithm.
 *
 * Phases:
 * 1. Cycle removal — DFS back-edge detection and reversal
 * 2. Layer assignment — Longest-path layering
 * 3. Crossing minimization — Barycenter heuristic
 * 4. Coordinate assignment — Fixed element sizes with spacing
 * 5. Sub-process layout — Recursive nested passes
 * 6. Edge routing — Orthogonal waypoints
 * 7. Overlap assertion — Post-condition validation
 */
export function layoutProcess(process: BpmnProcess): LayoutResult {
	const result = layoutFlowNodes(process.flowElements, process.sequenceFlows);
	assertNoOverlap(result);
	return result;
}

/**
 * Layout a set of flow nodes and sequence flows.
 * Used both for top-level processes and recursively for sub-processes.
 */
export function layoutFlowNodes(
	flowNodes: BpmnFlowElement[],
	sequenceFlows: BpmnSequenceFlow[],
): LayoutResult {
	if (flowNodes.length === 0) {
		return { nodes: [], edges: [] };
	}

	// Build node index
	const nodeIndex = new Map<string, BpmnFlowElement>();
	for (const node of flowNodes) {
		nodeIndex.set(node.id, node);
	}

	// Phase 1: Build graph and detect/remove cycles
	const graph = buildGraph(flowNodes, sequenceFlows);
	const backEdges = detectBackEdges(graph, sequenceFlows);
	const dag = backEdges.length > 0 ? reverseBackEdges(graph, backEdges) : graph;

	// Phase 2: Layer assignment
	const layers = assignLayers(dag);

	// Phase 3: Group by layer and minimize crossings
	const layerGroups = groupByLayer(layers);
	const orderedLayers = minimizeCrossings(layerGroups, dag);

	// Phase 4: Coordinate assignment
	const layoutNodes = assignCoordinates(orderedLayers, nodeIndex);

	// Phase 4b: Align linear sequences to a common y-baseline
	alignBranchBaselines(layoutNodes, dag);

	// Phase 4c: Align split/join gateway pairs to same y-coordinate
	alignSplitJoinPairs(layoutNodes, dag);

	// Phase 5: Sub-process layout (recursive) — may resize sub-process nodes
	const childResults = layoutSubProcesses(layoutNodes, nodeIndex);

	// Phase 5b: Re-assign x-coordinates after sub-process expansion, and shift children
	if (childResults.length > 0) {
		// Record pre-shift positions of all nodes
		const preShiftX = new Map<string, number>();
		for (const node of layoutNodes) {
			preShiftX.set(node.id, node.bounds.x);
		}

		reassignXCoordinates(layoutNodes, orderedLayers);

		// Apply the parent's x-shift to its children
		for (const { parentId, result: childResult } of childResults) {
			const parent = layoutNodes.find((n) => n.id === parentId);
			if (!parent) continue;
			const oldX = preShiftX.get(parentId) ?? parent.bounds.x;
			const dx = parent.bounds.x - oldX;
			if (dx === 0) continue;

			for (const childNode of childResult.nodes) {
				childNode.bounds.x += dx;
				if (childNode.labelBounds) childNode.labelBounds.x += dx;
			}
			for (const childEdge of childResult.edges) {
				for (const wp of childEdge.waypoints) {
					wp.x += dx;
				}
				if (childEdge.labelBounds) {
					childEdge.labelBounds.x += dx;
				}
			}
		}
	}

	// Phase 6: Edge routing (uses original back-edges for routing, not reversed)
	const nodeMap = new Map<string, LayoutNode>();
	for (const node of layoutNodes) {
		nodeMap.set(node.id, node);
	}
	// Also add child nodes for edge routing within sub-processes
	for (const { result: childResult } of childResults) {
		for (const childNode of childResult.nodes) {
			nodeMap.set(childNode.id, childNode);
		}
	}

	const edges = routeEdges(sequenceFlows, nodeMap, backEdges);

	// Merge child results into the main result
	const allNodes = [...layoutNodes];
	const allEdges = [...edges];
	for (const { result: childResult } of childResults) {
		allNodes.push(...childResult.nodes);
		allEdges.push(...childResult.edges);
	}

	return { nodes: allNodes, edges: allEdges };
}
