import type { BpmnElementType, BpmnFlowElement } from "../bpmn/bpmn-model.js"
import type { DirectedGraph } from "./graph.js"
import { topologicalSort } from "./graph.js"
import { ELEMENT_SIZES } from "./types.js"

export type FlowBlock = NodeBlock | GatewayBlock | SequenceBlock

export interface NodeBlock {
	kind: "node"
	id: string
	type: BpmnElementType
	label?: string
	width: number
	height: number
	x: number
	y: number
}

export interface SequenceBlock {
	kind: "sequence"
	items: FlowBlock[]
	width: number
	height: number
	x: number
	y: number
}

export interface GatewayBlock {
	kind: "gateway"
	split: NodeBlock
	join: NodeBlock
	branches: SequenceBlock[]
	branchColumnWidth: number
	width: number
	height: number
	x: number
	y: number
}

const GATEWAY_TYPES: ReadonlySet<string> = new Set([
	"exclusiveGateway",
	"parallelGateway",
	"inclusiveGateway",
	"eventBasedGateway",
	"complexGateway",
])

/** Make a NodeBlock for the given element. */
function makeNodeBlock(id: string, nodeIndex: Map<string, BpmnFlowElement>): NodeBlock {
	const el = nodeIndex.get(id)
	const type: BpmnElementType = (el?.type as BpmnElementType) ?? "serviceTask"
	const size = ELEMENT_SIZES[type] ?? { width: 100, height: 80 }
	return {
		kind: "node",
		id,
		type,
		label: el?.name,
		width: size.width,
		height: size.height,
		x: 0,
		y: 0,
	}
}

/**
 * Find the matching join gateway for a split gateway.
 * Uses a depth counter across the topoOrder of provided node IDs:
 * +1 for each split (outDegree≥2), -1 for each join (inDegree≥2).
 * First time depth returns to 0 → that's the matching join.
 */
function findMatchingJoin(
	splitId: string,
	orderedIds: string[],
	splitPos: number,
	dag: DirectedGraph,
	nodeIndex: Map<string, BpmnFlowElement>,
): string | undefined {
	let depth = 1
	for (let j = splitPos + 1; j < orderedIds.length; j++) {
		const id = orderedIds[j]
		if (!id) continue
		const el = nodeIndex.get(id)
		if (!el || !GATEWAY_TYPES.has(el.type)) continue
		const outDegree = (dag.successors.get(id) ?? []).length
		const inDegree = (dag.predecessors.get(id) ?? []).length
		if (outDegree >= 2) depth++
		if (inDegree >= 2) {
			depth--
			if (depth === 0) return id
		}
	}
	return undefined
}

/**
 * Collect all node IDs reachable from startId before reaching stopId (exclusive).
 * Uses BFS over DAG successors. The stop node is not included.
 */
function collectBranchNodes(startId: string, stopId: string, dag: DirectedGraph): string[] {
	const result: string[] = []
	const seen = new Set<string>()
	const queue = [startId]
	while (queue.length > 0) {
		const id = queue.shift()
		if (!id || seen.has(id) || id === stopId) continue
		seen.add(id)
		result.push(id)
		for (const succ of dag.successors.get(id) ?? []) {
			if (!seen.has(succ) && succ !== stopId) {
				queue.push(succ)
			}
		}
	}
	return result
}

/**
 * Build a SequenceBlock for the given ordered list of node IDs.
 * Recursively handles nested gateways.
 * Throws if the structure is unstructured (no matching join found).
 */
function buildSequenceFromIds(
	orderedIds: string[],
	dag: DirectedGraph,
	nodeIndex: Map<string, BpmnFlowElement>,
	topoPos: Map<string, number>,
): SequenceBlock {
	const items: FlowBlock[] = []
	let i = 0
	while (i < orderedIds.length) {
		const id = orderedIds[i]
		if (!id) {
			i++
			continue
		}
		const el = nodeIndex.get(id)
		const outDegree = (dag.successors.get(id) ?? []).length
		const isSplit = outDegree >= 2 && el !== undefined && GATEWAY_TYPES.has(el.type)

		if (isSplit) {
			// This is a split gateway — find its matching join within orderedIds
			const joinId = findMatchingJoin(id, orderedIds, i, dag, nodeIndex)
			if (!joinId) throw new Error(`No matching join for split gateway ${id}`)

			const joinPos = orderedIds.indexOf(joinId)
			if (joinPos < 0) throw new Error(`Join ${joinId} not in current sequence`)

			// For each successor of split, collect branch nodes (up to join)
			const successors = dag.successors.get(id) ?? []
			const branches: SequenceBlock[] = []

			for (const succId of successors) {
				// Collect nodes in this branch (BFS stopping at join)
				const branchNodes = collectBranchNodes(succId, joinId, dag)
				// Filter to only nodes that appear in orderedIds (safety)
				const branchSet = new Set(branchNodes)
				// Sort by topo position
				const branchOrdered = orderedIds.filter((nid) => branchSet.has(nid))
				branches.push(buildSequenceFromIds(branchOrdered, dag, nodeIndex, topoPos))
			}

			const splitBlock = makeNodeBlock(id, nodeIndex)
			const joinBlock = makeNodeBlock(joinId, nodeIndex)
			const gatewayBlock: GatewayBlock = {
				kind: "gateway",
				split: splitBlock,
				join: joinBlock,
				branches,
				branchColumnWidth: 0,
				width: 0,
				height: 0,
				x: 0,
				y: 0,
			}
			items.push(gatewayBlock)
			// Skip past the join gateway
			i = joinPos + 1
		} else {
			items.push(makeNodeBlock(id, nodeIndex))
			i++
		}
	}

	return { kind: "sequence", items, width: 0, height: 0, x: 0, y: 0 }
}

/**
 * Attempt to build block tree. Returns null if process is unstructured.
 */
export function buildBlockTree(
	dag: DirectedGraph,
	nodeIndex: Map<string, BpmnFlowElement>,
): SequenceBlock | null {
	try {
		const topoOrder = topologicalSort(dag)
		const topoPos = new Map<string, number>()
		for (let i = 0; i < topoOrder.length; i++) {
			const id = topoOrder[i]
			if (id) topoPos.set(id, i)
		}
		return buildSequenceFromIds(topoOrder, dag, nodeIndex, topoPos)
	} catch {
		return null
	}
}
