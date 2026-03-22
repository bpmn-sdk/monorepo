import type {
	BpmnDefinitions,
	BpmnFlowElement,
	BpmnProcess,
	BpmnSequenceFlow,
} from "./bpmn-model.js"

export interface StoryRenderOptions {
	/** If true, wrap in a complete HTML document with embedded CSS. Default false (returns fragment). */
	standalone?: boolean
	/** Color theme. Default "light". */
	theme?: "dark" | "light"
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function escapeHtml(s: string): string {
	return s
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;")
}

// ── Element classification ────────────────────────────────────────────────────

type CardRole =
	| "start"
	| "end"
	| "service"
	| "user"
	| "gateway"
	| "parallel"
	| "subprocess"
	| "event"
	| "task"

interface CardInfo {
	role: CardRole
	header: string
}

function getCardInfo(el: BpmnFlowElement, laneName?: string): CardInfo {
	switch (el.type) {
		case "startEvent":
			return { role: "start", header: "Process starts" }
		case "endEvent":
			return { role: "end", header: "Process ends" }
		case "serviceTask":
			return { role: "service", header: "System" }
		case "userTask":
			return { role: "user", header: laneName ?? "User" }
		case "businessRuleTask":
			return { role: "service", header: "Decision table" }
		case "scriptTask":
			return { role: "service", header: "Script" }
		case "exclusiveGateway":
		case "inclusiveGateway":
			return { role: "gateway", header: "Decision" }
		case "parallelGateway":
			return { role: "parallel", header: "Parallel" }
		case "callActivity":
			return { role: "subprocess", header: "Sub-process" }
		case "subProcess":
		case "eventSubProcess":
		case "transaction":
			return { role: "subprocess", header: "Sub-process" }
		case "intermediateCatchEvent":
		case "intermediateThrowEvent":
		case "boundaryEvent":
			return { role: "event", header: "Event" }
		default: {
			const t: string = el.type
			const header = t.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase())
			return { role: "task", header }
		}
	}
}

// ── Topological sort (Kahn's algorithm) ─────────────────────────────────────

function topoSort(elements: BpmnFlowElement[], flows: BpmnSequenceFlow[]): BpmnFlowElement[] {
	const idToEl = new Map<string, BpmnFlowElement>()
	for (const el of elements) idToEl.set(el.id, el)

	// in-degree and adjacency
	const inDegree = new Map<string, number>()
	const successors = new Map<string, string[]>()
	for (const el of elements) {
		inDegree.set(el.id, 0)
		successors.set(el.id, [])
	}

	for (const flow of flows) {
		if (!idToEl.has(flow.sourceRef) || !idToEl.has(flow.targetRef)) continue
		successors.get(flow.sourceRef)?.push(flow.targetRef)
		inDegree.set(flow.targetRef, (inDegree.get(flow.targetRef) ?? 0) + 1)
	}

	const queue: string[] = []
	for (const [id, deg] of inDegree) {
		if (deg === 0) queue.push(id)
	}

	const result: BpmnFlowElement[] = []
	const visited = new Set<string>()

	while (queue.length > 0) {
		const id = queue.shift()
		if (id === undefined) break
		if (visited.has(id)) continue
		visited.add(id)
		const el = idToEl.get(id)
		if (el) result.push(el)
		for (const next of successors.get(id) ?? []) {
			const deg = (inDegree.get(next) ?? 1) - 1
			inDegree.set(next, deg)
			if (deg === 0) queue.push(next)
		}
	}

	// Handle cycles: append any unvisited elements in original order
	for (const el of elements) {
		if (!visited.has(el.id)) result.push(el)
	}

	return result
}

// ── Lane mapping ─────────────────────────────────────────────────────────────

function buildLaneMap(process: BpmnProcess): Map<string, string> {
	const map = new Map<string, string>()
	if (!process.laneSet) return map
	for (const lane of process.laneSet.lanes) {
		const name = lane.name ?? lane.id
		for (const ref of lane.flowNodeRefs) {
			map.set(ref, name)
		}
	}
	return map
}

// ── Outgoing conditions ───────────────────────────────────────────────────────

function getOutgoingConditions(
	el: BpmnFlowElement,
	flows: BpmnSequenceFlow[],
): Array<{ label: string; condition: string }> {
	const outgoing = new Set(el.outgoing)
	const result: Array<{ label: string; condition: string }> = []
	for (const flow of flows) {
		if (!outgoing.has(flow.id)) continue
		if (flow.conditionExpression) {
			result.push({
				label: flow.name ?? flow.targetRef,
				condition: flow.conditionExpression.text,
			})
		}
	}
	return result
}

// ── Card HTML ─────────────────────────────────────────────────────────────────

function renderCard(el: BpmnFlowElement, flows: BpmnSequenceFlow[], laneName?: string): string {
	const { role, header } = getCardInfo(el, laneName)
	const name = "name" in el ? (el.name ?? "") : ""
	const conditions = role === "gateway" ? getOutgoingConditions(el, flows) : []

	let conditionsHtml = ""
	if (conditions.length > 0) {
		const items = conditions
			.map(
				(c) =>
					`<div class="bks-condition"><span class="bks-condition-label">${escapeHtml(c.label)}</span><span class="bks-condition-expr">${escapeHtml(c.condition)}</span></div>`,
			)
			.join("")
		conditionsHtml = `<div class="bks-conditions">${items}</div>`
	}

	return `<div class="bks-card bks-card--${role}" data-bpmnkit-id="${escapeHtml(el.id)}"><div class="bks-card-header">${escapeHtml(header)}</div><div class="bks-card-body">${escapeHtml(name)}</div>${conditionsHtml}</div>`
}

// ── Lane HTML ─────────────────────────────────────────────────────────────────

function renderLane(
	laneName: string,
	elements: BpmnFlowElement[],
	flows: BpmnSequenceFlow[],
	laneMap: Map<string, string>,
): string {
	if (elements.length === 0) return ""

	const cards = elements
		.map((el, i) => {
			const card = renderCard(el, flows, laneName === "_default" ? undefined : laneName)
			const arrow = i < elements.length - 1 ? '<div class="bks-arrow">→</div>' : ""
			return card + arrow
		})
		.join("")

	const laneHeader =
		laneName !== "_default" ? `<div class="bks-lane-header">${escapeHtml(laneName)}</div>` : ""

	return `<div class="bks-lane">${laneHeader}<div class="bks-lane-cards">${cards}</div></div>`
}

// ── Standalone CSS ────────────────────────────────────────────────────────────

function buildStandaloneCss(theme: "dark" | "light"): string {
	const isDark = theme === "dark"

	const vars = isDark
		? `
  --bks-bg: #0d0d16;
  --bks-surface: #161626;
  --bks-border: #2a2a42;
  --bks-fg: #cdd6f4;
  --bks-fg-muted: #8888a8;
  --bks-accent: #6b9df7;
  --bks-success: #22c55e;
  --bks-danger: #f87171;
  --bks-warn: #f59e0b;
  --bks-teal: #2dd4bf;
  --bks-purple: #a78bfa;`
		: `
  --bks-bg: #f4f4f8;
  --bks-surface: #ffffff;
  --bks-border: #d0d0e8;
  --bks-fg: #1a1a2e;
  --bks-fg-muted: #6666a0;
  --bks-accent: #1a56db;
  --bks-success: #16a34a;
  --bks-danger: #dc2626;
  --bks-warn: #d97706;
  --bks-teal: #0d9488;
  --bks-purple: #7c3aed;`

	return `
:root {${vars}
}
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
body {
  background: var(--bks-bg);
  color: var(--bks-fg);
  font-family: system-ui, -apple-system, sans-serif;
  font-size: 14px;
  line-height: 1.5;
  padding: 24px;
}
.bks-process-title {
  font-size: 20px;
  font-weight: 700;
  margin-bottom: 20px;
  color: var(--bks-fg);
}
.bks-lane {
  margin-bottom: 16px;
}
.bks-lane-header {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--bks-fg-muted);
  padding: 4px 0 8px;
  border-bottom: 1px solid var(--bks-border);
  margin-bottom: 10px;
}
.bks-lane-cards {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
}
.bks-card {
  background: var(--bks-surface);
  border: 1px solid var(--bks-border);
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.08);
  padding: 10px 14px;
  min-width: 120px;
  max-width: 200px;
}
.bks-card-header {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--bks-fg-muted);
  margin-bottom: 4px;
}
.bks-card-body {
  font-size: 13px;
  font-weight: 500;
  color: var(--bks-fg);
  word-break: break-word;
}
.bks-card--start { border-left: 3px solid var(--bks-success); }
.bks-card--end { border-left: 3px solid var(--bks-fg-muted); }
.bks-card--service { border-left: 3px solid var(--bks-accent); }
.bks-card--user { border-left: 3px solid var(--bks-teal); }
.bks-card--gateway { border-left: 3px solid var(--bks-warn); }
.bks-card--parallel { border-left: 3px solid var(--bks-fg-muted); }
.bks-card--subprocess { border-left: 3px solid var(--bks-purple); }
.bks-card--event { border-left: 3px solid var(--bks-accent); }
.bks-card--task { border-left: 3px solid var(--bks-border); }
.bks-conditions {
  margin-top: 6px;
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.bks-condition {
  font-size: 11px;
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}
.bks-condition-label {
  font-weight: 600;
  color: var(--bks-fg);
}
.bks-condition-expr {
  color: var(--bks-fg-muted);
  font-family: ui-monospace, monospace;
}
.bks-arrow {
  color: var(--bks-fg-muted);
  font-size: 18px;
  padding: 0 2px;
  flex-shrink: 0;
}
`
}

// ── Main renderer ─────────────────────────────────────────────────────────────

/** Render a BPMN process as a story-mode HTML string (no DOM required). */
export function renderStoryHtml(defs: BpmnDefinitions, options?: StoryRenderOptions): string {
	const standalone = options?.standalone ?? false
	const theme = options?.theme ?? "light"

	const process: BpmnProcess | undefined = defs.processes[0]
	if (!process) return standalone ? wrapDocument("", "", theme) : ""

	const laneMap = buildLaneMap(process)
	const sorted = topoSort(process.flowElements, process.sequenceFlows)

	// Group by lane
	const laneNames = new Set<string>()
	const laneElements = new Map<string, BpmnFlowElement[]>()

	if (process.laneSet && process.laneSet.lanes.length > 0) {
		// Collect unique lane names in alpha order
		const sortedLaneNames = process.laneSet.lanes
			.map((l) => l.name ?? l.id)
			.sort((a, b) => a.localeCompare(b))
		for (const n of sortedLaneNames) {
			laneNames.add(n)
			laneElements.set(n, [])
		}
		// Place each element in its lane
		for (const el of sorted) {
			const lane = laneMap.get(el.id) ?? sortedLaneNames[0]
			if (lane !== undefined) {
				laneElements.get(lane)?.push(el)
			}
		}
	} else {
		// No lane set — single default lane
		laneNames.add("_default")
		laneElements.set("_default", sorted)
	}

	let body = ""
	for (const laneName of laneNames) {
		const els = laneElements.get(laneName) ?? []
		body += renderLane(laneName, els, process.sequenceFlows, laneMap)
	}

	const processTitle = process.name ?? process.id
	const fragment = `<div class="bks-process-title">${escapeHtml(processTitle)}</div>${body}`

	if (standalone) {
		return wrapDocument(fragment, buildStandaloneCss(theme), theme)
	}
	return fragment
}

function wrapDocument(body: string, css: string, theme: "dark" | "light"): string {
	return `<!DOCTYPE html>
<html lang="en" data-theme="${theme}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>BPMN Story View</title>
<style>${css}</style>
</head>
<body>${body}</body>
</html>`
}
