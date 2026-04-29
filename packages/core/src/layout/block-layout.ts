import type { BpmnFlowElement } from "../bpmn/bpmn-model.js"
import type { FlowBlock, GatewayBlock, NodeBlock, SequenceBlock } from "./block-builder.js"
import { ELEMENT_SIZES } from "./types.js"
import type { Bounds, LayoutNode } from "./types.js"
import { GRID_CELL_WIDTH } from "./types.js"

const H_GAP = 50
const V_GAP = 80
const OUTER_PADDING = 40

/** Compute label bounds for a laid-out block node (same logic as coordinates.ts). */
function computeLabelBoundsForBlock(
	block: NodeBlock,
	nodeIndex: Map<string, BpmnFlowElement>,
): Bounds | undefined {
	const el = nodeIndex.get(block.id)
	if (!el?.name) return undefined

	const labelWidth = Math.min(Math.max(el.name.length * 7, 40), GRID_CELL_WIDTH)
	const labelHeight = 14

	switch (block.type) {
		case "startEvent":
		case "endEvent":
		case "intermediateThrowEvent":
		case "intermediateCatchEvent":
		case "exclusiveGateway":
		case "parallelGateway":
		case "inclusiveGateway":
		case "eventBasedGateway":
			return {
				x: block.x + block.width / 2 - labelWidth / 2,
				y: block.y + block.height + 4,
				width: labelWidth,
				height: labelHeight,
			}
		default:
			return undefined
	}
}

function countBlockNodes(block: FlowBlock): number {
	if (block.kind === "node") return 1
	if (block.kind === "sequence") return block.items.reduce((s, b) => s + countBlockNodes(b), 0)
	return 2 + block.branches.reduce((s, b) => s + countBlockNodes(b), 0)
}

/** Size a block bottom-up: sets width/height on all blocks in the tree. */
function sizeBlock(block: FlowBlock): void {
	if (block.kind === "node") {
		const size = ELEMENT_SIZES[block.type] ?? { width: 100, height: 80 }
		block.width = size.width
		block.height = size.height
	} else if (block.kind === "sequence") {
		for (const item of block.items) {
			sizeBlock(item)
		}
		const n = block.items.length
		block.width =
			block.items.reduce((sum, item) => sum + item.width, 0) + Math.max(0, n - 1) * H_GAP
		block.height = block.items.reduce((max, item) => Math.max(max, item.height), 0)
	} else {
		// GatewayBlock
		sizeBlock(block.split)
		sizeBlock(block.join)
		for (const branch of block.branches) {
			sizeBlock(branch)
		}

		block.branchColumnWidth =
			block.branches.length > 0 ? block.branches.reduce((max, b) => Math.max(max, b.width), 0) : 0

		block.width = block.split.width + H_GAP + block.branchColumnWidth + H_GAP + block.join.width

		// Empty branches (height=0) represent direct bypass edges and need a minimum
		// lane height so subsequent task branches don't overlap the direct edge routing.
		const totalBranchH =
			block.branches.reduce((sum, b) => sum + Math.max(b.height, V_GAP), 0) +
			Math.max(0, block.branches.length - 1) * V_GAP

		block.height = Math.max(totalBranchH, block.split.height, block.join.height)
	}
}

/** Position a block top-down given its absolute (x,y) top-left origin. */
function positionBlock(block: FlowBlock, x: number, y: number): void {
	block.x = x
	block.y = y

	if (block.kind === "node") {
		// Nothing more to do — leaf
	} else if (block.kind === "sequence") {
		let curX = x
		for (const item of block.items) {
			// Center each item vertically within the sequence
			const itemY = y + (block.height - item.height) / 2
			positionBlock(item, curX, itemY)
			curX += item.width + H_GAP
		}
	} else {
		// GatewayBlock: split at left, join at right, branches stacked in middle
		const splitY = y + block.height / 2 - block.split.height / 2
		positionBlock(block.split, x, splitY)

		const joinX = x + block.width - block.join.width
		const joinY = y + block.height / 2 - block.join.height / 2
		positionBlock(block.join, joinX, joinY)

		// Reorder branches: heaviest (most nodes) at center, alternating above/below
		const sortedBySize = [...block.branches].sort((a, b) => countBlockNodes(b) - countBlockNodes(a))
		const bc = block.branches.length
		const orderedBranches = new Array<SequenceBlock>(bc)
		const bm = Math.floor((bc - 1) / 2)
		// biome-ignore lint/style/noNonNullAssertion: sortedBySize is non-empty (bc >= 1)
		orderedBranches[bm] = sortedBySize[0]!
		let ba = bm - 1
		let bb = bm + 1
		for (let si = 1; si < bc; ) {
			// biome-ignore lint/style/noNonNullAssertion: si < bc ensures element exists
			if (bb < bc && si < bc) orderedBranches[bb++] = sortedBySize[si++]!
			// biome-ignore lint/style/noNonNullAssertion: si < bc ensures element exists
			if (ba >= 0 && si < bc) orderedBranches[ba--] = sortedBySize[si++]!
		}
		block.branches = orderedBranches

		// Branches stacked top-to-bottom, centered vertically
		const totalBranchH =
			block.branches.reduce((sum, b) => sum + b.height, 0) +
			Math.max(0, block.branches.length - 1) * V_GAP

		const branchX = x + block.split.width + H_GAP
		let branchY = y + (block.height - totalBranchH) / 2

		for (const branch of block.branches) {
			const effectiveH = Math.max(branch.height, V_GAP)
			positionBlock(branch, branchX, branchY + (effectiveH - branch.height) / 2)
			branchY += effectiveH + V_GAP
		}
	}
}

/** Flatten block tree into LayoutNode list. */
function flattenBlock(
	block: FlowBlock,
	nodeIndex: Map<string, BpmnFlowElement>,
	out: LayoutNode[],
): void {
	if (block.kind === "node") {
		const layoutNode: LayoutNode = {
			id: block.id,
			type: block.type,
			bounds: { x: block.x, y: block.y, width: block.width, height: block.height },
			layer: 0,
			position: 0,
			label: block.label,
		}
		layoutNode.labelBounds = computeLabelBoundsForBlock(block, nodeIndex)
		out.push(layoutNode)
	} else if (block.kind === "sequence") {
		for (const item of block.items) {
			flattenBlock(item, nodeIndex, out)
		}
	} else {
		flattenBlock(block.split, nodeIndex, out)
		flattenBlock(block.join, nodeIndex, out)
		for (const branch of block.branches) {
			flattenBlock(branch, nodeIndex, out)
		}
	}
}

/**
 * Apply block-based layout: size (bottom-up) then position (top-down).
 * Returns LayoutNode[] with absolute positions.
 */
export function applyBlockLayout(
	root: SequenceBlock,
	nodeIndex: Map<string, BpmnFlowElement>,
): LayoutNode[] {
	sizeBlock(root)
	positionBlock(root, OUTER_PADDING, OUTER_PADDING)

	const nodes: LayoutNode[] = []
	flattenBlock(root, nodeIndex, nodes)
	return nodes
}
