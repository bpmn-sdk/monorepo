import type { BpmnBounds, BpmnDefinitions, BpmnDiShape } from "../bpmn/bpmn-model.js"
import { Bpmn } from "../bpmn/index.js"
import { layoutProcess } from "./layout-engine.js"
import type { LayoutNode } from "./types.js"

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ElementPosition {
	id: string
	type: string
	name?: string
	cx: number
	cy: number
	x: number
	y: number
	width: number
	height: number
}

export interface ElementComparison {
	id: string
	type: string
	name?: string
	ref: { cx: number; cy: number }
	auto: { cx: number; cy: number }
	/** Signed displacement: auto − ref. */
	delta: { dx: number; dy: number }
	/** Euclidean distance between centres. */
	distance: number
}

/** An edge whose auto-layout X order contradicts the flow direction. */
export interface FlowOrderViolation {
	sourceId: string
	targetId: string
	sourceName?: string
	targetName?: string
	description: string
}

export interface BenchmarkResult {
	/** Original file name (for reporting). */
	fileName: string
	elementCount: number
	flowCount: number
	/** Elements present in both reference and auto-layout. */
	matchedCount: number
	elements: ElementComparison[]
	orderViolations: FlowOrderViolation[]
	avgDistance: number
	maxDistance: number
	/** 90th-percentile distance (more robust than max). */
	p90Distance: number
	ref: BoundingBox
	auto: BoundingBox
	/** auto.width / ref.width  (1.0 = same width). */
	widthRatio: number
	/** auto.height / ref.height  (1.0 = same height). */
	heightRatio: number
}

export interface BoundingBox {
	x: number
	y: number
	width: number
	height: number
}

// ── Reference extraction ──────────────────────────────────────────────────────

/**
 * Extracts element positions from the BPMN DI data (the hand-crafted or
 * tool-generated layout stored in the XML file).
 */
export function parseReferenceLayout(defs: BpmnDefinitions): ElementPosition[] {
	const process = defs.processes[0]
	const diagram = defs.diagrams[0]
	if (!process || !diagram) return []

	// Build a name lookup from flow elements
	const names = new Map<string, string | undefined>()
	const types = new Map<string, string>()
	const collectNames = (elements: typeof process.flowElements): void => {
		for (const el of elements) {
			names.set(el.id, "name" in el ? (el.name as string | undefined) : undefined)
			types.set(el.id, el.type)
			if (
				el.type === "subProcess" ||
				el.type === "adHocSubProcess" ||
				el.type === "eventSubProcess" ||
				el.type === "transaction"
			) {
				collectNames(el.flowElements)
			}
		}
	}
	collectNames(process.flowElements)

	const positions: ElementPosition[] = []
	for (const shape of diagram.plane.shapes) {
		const b = shape.bounds
		positions.push({
			id: shape.bpmnElement,
			type: types.get(shape.bpmnElement) ?? "unknown",
			name: names.get(shape.bpmnElement),
			cx: b.x + b.width / 2,
			cy: b.y + b.height / 2,
			x: b.x,
			y: b.y,
			width: b.width,
			height: b.height,
		})
	}
	return positions
}

// ── Auto-layout extraction ────────────────────────────────────────────────────

/**
 * Runs the auto-layout engine on the process and returns element positions.
 */
export function generateAutoLayout(defs: BpmnDefinitions): ElementPosition[] {
	const process = defs.processes[0]
	if (!process) return []

	const result = layoutProcess(process)
	return result.nodes.map((n: LayoutNode) => ({
		id: n.id,
		type: n.type,
		name: n.label,
		cx: n.bounds.x + n.bounds.width / 2,
		cy: n.bounds.y + n.bounds.height / 2,
		x: n.bounds.x,
		y: n.bounds.y,
		width: n.bounds.width,
		height: n.bounds.height,
	}))
}

// ── Comparison ────────────────────────────────────────────────────────────────

function boundingBox(positions: ElementPosition[]): BoundingBox {
	if (positions.length === 0) return { x: 0, y: 0, width: 0, height: 0 }
	let minX = Number.POSITIVE_INFINITY
	let minY = Number.POSITIVE_INFINITY
	let maxX = Number.NEGATIVE_INFINITY
	let maxY = Number.NEGATIVE_INFINITY
	for (const p of positions) {
		minX = Math.min(minX, p.x)
		minY = Math.min(minY, p.y)
		maxX = Math.max(maxX, p.x + p.width)
		maxY = Math.max(maxY, p.y + p.height)
	}
	return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
}

function percentile(sorted: number[], p: number): number {
	if (sorted.length === 0) return 0
	const idx = Math.ceil((p / 100) * sorted.length) - 1
	return sorted[Math.max(0, Math.min(idx, sorted.length - 1))] ?? 0
}

/**
 * Checks whether each sequence flow A→B has A to the left of B in both the
 * reference and the auto-layout.  Mismatches indicate the auto-layout placed
 * elements in the wrong order.
 */
function detectOrderViolations(
	defs: BpmnDefinitions,
	refMap: Map<string, ElementPosition>,
	autoMap: Map<string, ElementPosition>,
): FlowOrderViolation[] {
	const process = defs.processes[0]
	if (!process) return []

	const violations: FlowOrderViolation[] = []

	const checkFlows = (flows: typeof process.sequenceFlows): void => {
		for (const flow of flows) {
			const refSrc = refMap.get(flow.sourceRef)
			const refTgt = refMap.get(flow.targetRef)
			const autoSrc = autoMap.get(flow.sourceRef)
			const autoTgt = autoMap.get(flow.targetRef)
			if (!refSrc || !refTgt || !autoSrc || !autoTgt) continue

			// In the reference, determine primary direction of this flow.
			const refDx = refTgt.cx - refSrc.cx
			const refDy = refTgt.cy - refSrc.cy
			// Only check edges that are predominantly horizontal in the reference
			// (|dx| > |dy|), as those represent clear left-to-right ordering.
			if (Math.abs(refDx) <= Math.abs(refDy)) continue
			const refGoesRight = refDx > 0

			const autoDx = autoTgt.cx - autoSrc.cx
			const autoGoesRight = autoDx > 0

			if (refGoesRight !== autoGoesRight) {
				const srcLabel = refSrc.name ? `"${refSrc.name}"` : refSrc.id
				const tgtLabel = refTgt.name ? `"${refTgt.name}"` : refTgt.id
				violations.push({
					sourceId: flow.sourceRef,
					targetId: flow.targetRef,
					sourceName: refSrc.name,
					targetName: refTgt.name,
					description:
						`Flow ${srcLabel} → ${tgtLabel}: ` +
						`reference goes ${refGoesRight ? "right" : "left"} (Δx=${Math.round(refDx)}), ` +
						`auto-layout goes ${autoGoesRight ? "right" : "left"} (Δx=${Math.round(autoDx)})`,
				})
			}
		}
	}

	checkFlows(process.sequenceFlows)
	return violations
}

/**
 * Compares a reference layout (from XML DI) with an auto-generated layout.
 */
export function compareLayouts(
	defs: BpmnDefinitions,
	ref: ElementPosition[],
	auto: ElementPosition[],
	fileName = "",
): BenchmarkResult {
	const refMap = new Map(ref.map((p) => [p.id, p]))
	const autoMap = new Map(auto.map((p) => [p.id, p]))

	const comparisons: ElementComparison[] = []
	for (const refEl of ref) {
		const autoEl = autoMap.get(refEl.id)
		if (!autoEl) continue
		const dx = autoEl.cx - refEl.cx
		const dy = autoEl.cy - refEl.cy
		comparisons.push({
			id: refEl.id,
			type: refEl.type,
			name: refEl.name,
			ref: { cx: refEl.cx, cy: refEl.cy },
			auto: { cx: autoEl.cx, cy: autoEl.cy },
			delta: { dx, dy },
			distance: Math.hypot(dx, dy),
		})
	}

	const distances = comparisons.map((c) => c.distance).sort((a, b) => a - b)
	const avgDistance =
		distances.length > 0 ? distances.reduce((s, d) => s + d, 0) / distances.length : 0
	const maxDistance = distances[distances.length - 1] ?? 0
	const p90Distance = percentile(distances, 90)

	const refBbox = boundingBox(ref)
	const autoBbox = boundingBox(auto)

	const orderViolations = detectOrderViolations(defs, refMap, autoMap)

	const process = defs.processes[0]
	const flowCount = process?.sequenceFlows.length ?? 0

	return {
		fileName,
		elementCount: ref.length,
		flowCount,
		matchedCount: comparisons.length,
		elements: comparisons.sort((a, b) => b.distance - a.distance),
		orderViolations,
		avgDistance,
		maxDistance,
		p90Distance,
		ref: refBbox,
		auto: autoBbox,
		widthRatio: refBbox.width > 0 ? autoBbox.width / refBbox.width : 1,
		heightRatio: refBbox.height > 0 ? autoBbox.height / refBbox.height : 1,
	}
}

// ── Main entry point ──────────────────────────────────────────────────────────

/**
 * Full benchmark pipeline: parse → extract reference layout → auto-layout → compare.
 */
export function benchmarkLayout(xml: string, fileName = ""): BenchmarkResult {
	const defs = Bpmn.parse(xml)
	const ref = parseReferenceLayout(defs)
	const auto = generateAutoLayout(defs)
	return compareLayouts(defs, ref, auto, fileName)
}

// ── Formatting helpers ────────────────────────────────────────────────────────

/** Format a BenchmarkResult as a human-readable report string. */
export function formatBenchmarkResult(r: BenchmarkResult): string {
	const lines: string[] = []
	const w = (s: string, n: number): string => s.padEnd(n)
	const rn = (n: number): string => String(Math.round(n))
	const rf = (n: number, d = 1): string => n.toFixed(d)

	lines.push(
		`  Elements: ${r.elementCount}  Flows: ${r.flowCount}  Matched: ${r.matchedCount}/${r.elementCount}`,
	)
	lines.push(
		`  Avg dist: ${rf(r.avgDistance)}px  P90: ${rf(r.p90Distance)}px  Max: ${rf(r.maxDistance)}px`,
	)
	lines.push(
		`  Size:  ref ${rn(r.ref.width)}×${rn(r.ref.height)}  auto ${rn(r.auto.width)}×${rn(r.auto.height)}` +
			`  (${rf(r.widthRatio)}× wide, ${rf(r.heightRatio)}× tall)`,
	)

	if (r.orderViolations.length > 0) {
		lines.push(`  Order violations: ${r.orderViolations.length}`)
		for (const v of r.orderViolations) {
			lines.push(`    ✗ ${v.description}`)
		}
	} else {
		lines.push("  Order violations: 0 ✓")
	}

	const topN = r.elements.slice(0, 5)
	if (topN.length > 0) {
		lines.push("  Top deviations:")
		for (const el of topN) {
			const label = el.name ? `"${el.name}"` : el.id
			const sign = (n: number): string => (n >= 0 ? `+${rn(n)}` : rn(n))
			lines.push(
				`    ${w(`${el.type} ${label}`, 40)} ` +
					`Δ(${sign(el.delta.dx)}, ${sign(el.delta.dy)})  dist=${rf(el.distance)}px`,
			)
		}
	}

	return lines.join("\n")
}
