import type { DmnDefinitions, DmnDiagram, DmnDiagramEdge, DmnDiagramShape } from "./dmn-model.js"
import { parseDmn } from "./dmn-parser.js"

// ── Element sizes (matches Camunda Modeler defaults) ──────────────────────────

const SIZES = {
	decision: { width: 180, height: 80 },
	inputData: { width: 125, height: 45 },
	knowledgeSource: { width: 100, height: 63 },
	businessKnowledgeModel: { width: 160, height: 80 },
} as const

type NodeKind = keyof typeof SIZES

const H_GAP = 60 // horizontal gap between layers
const V_GAP = 40 // vertical gap within a layer
const MARGIN_X = 160
const MARGIN_Y = 100

// ── Internal types ────────────────────────────────────────────────────────────

interface DrgNode {
	id: string
	kind: NodeKind
	name?: string
}

interface PositionedNode extends DrgNode {
	layer: number
	x: number
	y: number
	width: number
	height: number
}

interface RequirementEdge {
	/** The required (upstream) element */
	sourceId: string
	/** The element that declares the requirement */
	targetId: string
	/** The requirement element ID (used as dmnElementRef for the edge) */
	reqId: string
}

// ── Graph collection ──────────────────────────────────────────────────────────

function collectNodes(defs: DmnDefinitions): DrgNode[] {
	const nodes: DrgNode[] = []
	for (const d of defs.decisions) nodes.push({ id: d.id, kind: "decision", name: d.name })
	for (const d of defs.inputData) nodes.push({ id: d.id, kind: "inputData", name: d.name })
	for (const ks of defs.knowledgeSources)
		nodes.push({ id: ks.id, kind: "knowledgeSource", name: ks.name })
	for (const bkm of defs.businessKnowledgeModels)
		nodes.push({ id: bkm.id, kind: "businessKnowledgeModel", name: bkm.name })
	return nodes
}

function collectEdges(defs: DmnDefinitions): RequirementEdge[] {
	const edges: RequirementEdge[] = []

	for (const d of defs.decisions) {
		for (const req of d.informationRequirements) {
			const src = req.requiredDecision ?? req.requiredInput ?? ""
			if (src) edges.push({ sourceId: src, targetId: d.id, reqId: req.id })
		}
		for (const req of d.knowledgeRequirements) {
			edges.push({ sourceId: req.requiredKnowledge, targetId: d.id, reqId: req.id })
		}
		for (const req of d.authorityRequirements) {
			const src = req.requiredAuthority ?? req.requiredDecision ?? req.requiredInput ?? ""
			if (src) edges.push({ sourceId: src, targetId: d.id, reqId: req.id })
		}
	}

	for (const bkm of defs.businessKnowledgeModels) {
		for (const req of bkm.knowledgeRequirements) {
			edges.push({ sourceId: req.requiredKnowledge, targetId: bkm.id, reqId: req.id })
		}
		for (const req of bkm.authorityRequirements) {
			const src = req.requiredAuthority ?? req.requiredDecision ?? req.requiredInput ?? ""
			if (src) edges.push({ sourceId: src, targetId: bkm.id, reqId: req.id })
		}
	}

	for (const ks of defs.knowledgeSources) {
		for (const req of ks.authorityRequirements) {
			const src = req.requiredAuthority ?? req.requiredDecision ?? req.requiredInput ?? ""
			if (src) edges.push({ sourceId: src, targetId: ks.id, reqId: req.id })
		}
	}

	return edges
}

// ── Layer assignment (longest-path / BFS) ────────────────────────────────────

function assignLayers(nodes: DrgNode[], edges: RequirementEdge[]): Map<string, number> {
	const outgoing = new Map<string, string[]>()
	const inDegree = new Map<string, number>()

	for (const n of nodes) {
		outgoing.set(n.id, [])
		inDegree.set(n.id, 0)
	}

	for (const e of edges) {
		outgoing.get(e.sourceId)?.push(e.targetId)
		inDegree.set(e.targetId, (inDegree.get(e.targetId) ?? 0) + 1)
	}

	const layers = new Map<string, number>()
	const queue: string[] = []

	for (const n of nodes) {
		if ((inDegree.get(n.id) ?? 0) === 0) {
			layers.set(n.id, 0)
			queue.push(n.id)
		}
	}

	let i = 0
	while (i < queue.length) {
		const id = queue[i++]
		if (id === undefined) continue
		const layer = layers.get(id) ?? 0
		for (const succ of outgoing.get(id) ?? []) {
			const newLayer = Math.max(layers.get(succ) ?? 0, layer + 1)
			layers.set(succ, newLayer)
			const deg = (inDegree.get(succ) ?? 1) - 1
			inDegree.set(succ, deg)
			if (deg === 0) queue.push(succ)
		}
	}

	// Disconnected nodes default to layer 0
	for (const n of nodes) {
		if (!layers.has(n.id)) layers.set(n.id, 0)
	}

	return layers
}

// ── Layout ────────────────────────────────────────────────────────────────────

/**
 * Auto-layout a DMN definitions object.
 * Assigns DMNDI diagram positions to all DRG elements using a left-to-right
 * layered layout based on the requirement DAG.
 */
export function layoutDmn(defs: DmnDefinitions): DmnDefinitions {
	const nodes = collectNodes(defs)
	if (nodes.length === 0) return defs

	const edges = collectEdges(defs)
	const layerMap = assignLayers(nodes, edges)

	// Group nodes by layer
	const byLayer = new Map<number, DrgNode[]>()
	for (const n of nodes) {
		const layer = layerMap.get(n.id) ?? 0
		const arr = byLayer.get(layer)
		if (arr) arr.push(n)
		else byLayer.set(layer, [n])
	}

	const sortedLayers = [...byLayer.keys()].sort((a, b) => a - b)

	// Compute x per layer (left = upstream/leaf, right = final decision)
	let x = MARGIN_X
	const xByLayer = new Map<number, number>()
	const widthByLayer = new Map<number, number>()
	for (const layerIdx of sortedLayers) {
		const layerNodes = byLayer.get(layerIdx) ?? []
		const maxWidth = Math.max(...layerNodes.map((n) => SIZES[n.kind].width))
		xByLayer.set(layerIdx, x)
		widthByLayer.set(layerIdx, maxWidth)
		x += maxWidth + H_GAP
	}

	// Compute total height per layer (for vertical centering)
	const heightByLayer = new Map<number, number>()
	for (const layerIdx of sortedLayers) {
		const layerNodes = byLayer.get(layerIdx) ?? []
		let h = 0
		for (const n of layerNodes) {
			h += SIZES[n.kind].height
		}
		h += Math.max(0, layerNodes.length - 1) * V_GAP
		heightByLayer.set(layerIdx, h)
	}

	const maxHeight = Math.max(...[...heightByLayer.values()], 0)

	// Position nodes
	const positioned = new Map<string, PositionedNode>()
	for (const layerIdx of sortedLayers) {
		const layerNodes = byLayer.get(layerIdx) ?? []
		const layerX = xByLayer.get(layerIdx) ?? MARGIN_X
		const layerHeight = heightByLayer.get(layerIdx) ?? 0
		const startY = MARGIN_Y + (maxHeight - layerHeight) / 2
		let y = startY

		for (const n of layerNodes) {
			const size = SIZES[n.kind]
			positioned.set(n.id, {
				...n,
				layer: layerIdx,
				x: layerX,
				y,
				width: size.width,
				height: size.height,
			})
			y += size.height + V_GAP
		}
	}

	// Build shapes
	const shapes: DmnDiagramShape[] = []
	for (const [, node] of positioned) {
		shapes.push({
			dmnElementRef: node.id,
			bounds: { x: node.x, y: node.y, width: node.width, height: node.height },
		})
	}

	// Build edges — connect right edge of source to left edge of target
	const diagramEdges: DmnDiagramEdge[] = []
	for (const edge of edges) {
		const src = positioned.get(edge.sourceId)
		const tgt = positioned.get(edge.targetId)
		if (!src || !tgt) continue

		const srcX = src.x + src.width
		const srcY = src.y + src.height / 2
		const tgtX = tgt.x
		const tgtY = tgt.y + tgt.height / 2

		diagramEdges.push({
			dmnElementRef: edge.reqId,
			waypoints: [
				{ x: srcX, y: srcY },
				{ x: tgtX, y: tgtY },
			],
		})
	}

	const diagram: DmnDiagram = { shapes, edges: diagramEdges }
	return { ...defs, diagram }
}

// ── Benchmark ─────────────────────────────────────────────────────────────────

export interface DmnElementPosition {
	id: string
	name?: string
	kind: NodeKind
	ref: { cx: number; cy: number }
	auto: { cx: number; cy: number }
	delta: { dx: number; dy: number }
	distance: number
}

export interface DmnBenchmarkResult {
	fileName: string
	elementCount: number
	matchedCount: number
	avgDistance: number
	p90Distance: number
	maxDistance: number
	elements: DmnElementPosition[]
}

/** Parse the reference layout, strip DMNDI, run auto-layout, and compare. */
export function benchmarkDmnLayout(xml: string, fileName: string): DmnBenchmarkResult {
	const ref = parseDmn(xml)
	const refShapes = new Map<string, DmnDiagramShape>()
	for (const shape of ref.diagram?.shapes ?? []) {
		refShapes.set(shape.dmnElementRef, shape)
	}

	const stripped: DmnDefinitions = { ...ref, diagram: undefined }
	const layouted = layoutDmn(stripped)
	const autoShapes = new Map<string, DmnDiagramShape>()
	for (const shape of layouted.diagram?.shapes ?? []) {
		autoShapes.set(shape.dmnElementRef, shape)
	}

	const allNodes = collectNodes(ref)
	const comparisons: DmnElementPosition[] = []
	let matchedCount = 0

	for (const n of allNodes) {
		const refShape = refShapes.get(n.id)
		const autoShape = autoShapes.get(n.id)
		if (!refShape || !autoShape) continue
		matchedCount++

		const refCx = refShape.bounds.x + refShape.bounds.width / 2
		const refCy = refShape.bounds.y + refShape.bounds.height / 2
		const autoCx = autoShape.bounds.x + autoShape.bounds.width / 2
		const autoCy = autoShape.bounds.y + autoShape.bounds.height / 2
		const dx = autoCx - refCx
		const dy = autoCy - refCy
		const distance = Math.sqrt(dx * dx + dy * dy)

		comparisons.push({
			id: n.id,
			name: n.name,
			kind: n.kind,
			ref: { cx: refCx, cy: refCy },
			auto: { cx: autoCx, cy: autoCy },
			delta: { dx, dy },
			distance,
		})
	}

	comparisons.sort((a, b) => b.distance - a.distance)

	const avgDistance =
		comparisons.length > 0
			? comparisons.reduce((s, c) => s + c.distance, 0) / comparisons.length
			: 0
	const p90Distance =
		comparisons.length > 0 ? (comparisons[Math.floor(comparisons.length * 0.9)]?.distance ?? 0) : 0
	const maxDistance = comparisons[0]?.distance ?? 0

	return {
		fileName,
		elementCount: allNodes.length,
		matchedCount,
		avgDistance,
		p90Distance,
		maxDistance,
		elements: comparisons,
	}
}
