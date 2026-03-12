import type { DashboardData, TimePoint } from "../types.js"

// ── Metric definitions ────────────────────────────────────────────────────────

type MetricKey = keyof Omit<
	DashboardData,
	"definitions" | "usageTotalProcessInstances" | "usageDecisionInstances" | "usageAssignees"
>

const METRICS: ReadonlyArray<{ key: MetricKey; label: string; cssVar: string }> = [
	{ key: "activeInstances", label: "Active Instances", cssVar: "--bpmn-accent" },
	{ key: "openIncidents", label: "Open Incidents", cssVar: "--op-c-amber" },
	{ key: "activeJobs", label: "Active Jobs", cssVar: "--op-c-green" },
	{ key: "pendingTasks", label: "Pending Tasks", cssVar: "--op-c-purple" },
]

const MARGIN = { top: 12, right: 16, bottom: 28, left: 36 }
const SVG_NS = "http://www.w3.org/2000/svg"
/** Maximum number of time points shown in the bar chart. */
const MAX_BARS = 40

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtAgo(ms: number): string {
	if (ms < 5_000) return "now"
	if (ms < 120_000) return `${Math.round(ms / 1_000)}s`
	const mins = Math.round(ms / 60_000)
	if (mins < 60) return `${mins}m`
	return `${Math.round(mins / 60)}h`
}

function pickTickInterval(spanMs: number): number {
	const ladder = [
		15_000,
		30_000,
		60_000,
		2 * 60_000,
		5 * 60_000,
		10 * 60_000,
		15 * 60_000,
		30 * 60_000,
		60 * 60_000,
		2 * 3_600_000,
	]
	for (const t of ladder) {
		if (spanMs / t <= 5) return t
	}
	return 3_600_000
}

function niceMax(raw: number): number {
	if (raw <= 0) return 4
	const mag = 10 ** Math.floor(Math.log10(raw))
	const nice = Math.ceil(raw / mag) * mag
	return Math.max(nice, 4)
}

function makeSvgEl(tag: string): SVGElement {
	return document.createElementNS(SVG_NS, tag) as SVGElement
}

// ── Chart factory ─────────────────────────────────────────────────────────────

export function createBarChart(container: HTMLElement): {
	update(history: TimePoint[]): void
	destroy(): void
} {
	const el = document.createElement("div")
	el.className = "op-chart"
	container.appendChild(el)

	// Legend + "Live" badge row
	const legendRow = document.createElement("div")
	legendRow.className = "op-chart-legend-row"

	const legend = document.createElement("div")
	legend.className = "op-chart-legend"

	const liveBadge = document.createElement("span")
	liveBadge.className = "op-chart-live"
	liveBadge.textContent = "Live"
	liveBadge.title = "No historical API available — chart accumulates data live during this session"

	legendRow.appendChild(legend)
	legendRow.appendChild(liveBadge)
	el.appendChild(legendRow)

	const active = new Set<MetricKey>(METRICS.map((m) => m.key))

	for (const m of METRICS) {
		const btn = document.createElement("button")
		btn.className = "op-chart-legend-btn op-chart-legend-btn--active"
		btn.style.setProperty("--dot", `var(${m.cssVar})`)

		const dot = document.createElement("span")
		dot.className = "op-chart-legend-dot"
		btn.appendChild(dot)
		btn.appendChild(document.createTextNode(m.label))

		btn.addEventListener("click", () => {
			if (active.has(m.key)) {
				active.delete(m.key)
				btn.classList.remove("op-chart-legend-btn--active")
			} else {
				active.add(m.key)
				btn.classList.add("op-chart-legend-btn--active")
			}
			drawLast()
		})
		legend.appendChild(btn)
	}

	// SVG element
	const svg = makeSvgEl("svg") as SVGSVGElement
	svg.setAttribute("class", "op-chart-svg")
	svg.setAttribute("aria-hidden", "true")
	el.appendChild(svg as unknown as HTMLElement)

	let lastHistory: TimePoint[] = []
	let svgWidth = 0
	let svgHeight = 0

	function clearSvg(): void {
		while (svg.firstChild) svg.removeChild(svg.firstChild)
	}

	function drawLoading(): void {
		const cx = svgWidth / 2
		const cy = svgHeight / 2
		const offsets = [-16, 0, 16]
		for (let i = 0; i < offsets.length; i++) {
			const offset = offsets[i] ?? 0
			const circle = makeSvgEl("circle")
			circle.setAttribute("cx", String(cx + offset))
			circle.setAttribute("cy", String(cy))
			circle.setAttribute("r", "4")
			circle.setAttribute("class", "op-chart-dot-pulse")
			circle.setAttribute("style", `animation-delay: ${i * 0.2}s`)
			svg.appendChild(circle)
		}
	}

	function draw(history: TimePoint[]): void {
		clearSvg()
		if (svgWidth <= 0 || svgHeight <= 0) return

		// Use the most recent MAX_BARS points
		const pts = history.length > MAX_BARS ? history.slice(history.length - MAX_BARS) : history

		if (pts.length < 1) {
			drawLoading()
			return
		}

		const plotW = Math.max(1, svgWidth - MARGIN.left - MARGIN.right)
		const plotH = Math.max(1, svgHeight - MARGIN.top - MARGIN.bottom)

		const newest = pts[pts.length - 1]
		const oldest = pts[0]
		if (!newest || !oldest) return

		const newestTs = newest.ts
		const oldestTs = oldest.ts
		const timeSpan = Math.max(1, newestTs - oldestTs)

		// Y scale
		let yMax = 0
		for (const pt of pts) {
			for (const m of METRICS) {
				if (active.has(m.key)) {
					const v = pt.data[m.key]
					if (v > yMax) yMax = v
				}
			}
		}
		yMax = niceMax(yMax)

		function toY(v: number): number {
			return MARGIN.top + plotH - (v / yMax) * plotH
		}

		// Y grid + labels
		for (let i = 0; i <= 4; i++) {
			const v = Math.round((i / 4) * yMax)
			const y = toY(v)

			const line = makeSvgEl("line")
			line.setAttribute("x1", String(MARGIN.left))
			line.setAttribute("x2", String(MARGIN.left + plotW))
			line.setAttribute("y1", String(y))
			line.setAttribute("y2", String(y))
			line.setAttribute("class", i === 0 ? "op-chart-axis" : "op-chart-grid")
			svg.appendChild(line)

			const lbl = makeSvgEl("text")
			lbl.setAttribute("x", String(MARGIN.left - 6))
			lbl.setAttribute("y", String(y + 4))
			lbl.setAttribute("text-anchor", "end")
			lbl.setAttribute("class", "op-chart-axis-label")
			lbl.textContent = String(v)
			svg.appendChild(lbl)
		}

		// X axis baseline
		const xBase = makeSvgEl("line")
		xBase.setAttribute("x1", String(MARGIN.left))
		xBase.setAttribute("x2", String(MARGIN.left + plotW))
		xBase.setAttribute("y1", String(MARGIN.top + plotH))
		xBase.setAttribute("y2", String(MARGIN.top + plotH))
		xBase.setAttribute("class", "op-chart-axis")
		svg.appendChild(xBase)

		// X labels
		if (pts.length > 1) {
			const tickInterval = pickTickInterval(timeSpan)
			const alignedFirst = Math.ceil(oldestTs / tickInterval) * tickInterval
			const rightEdge = MARGIN.left + plotW
			const minSpacingPx = 36
			let prevLabelX = Number.NEGATIVE_INFINITY

			for (let ts = alignedFirst; ts < newestTs - tickInterval * 0.1; ts += tickInterval) {
				const x = MARGIN.left + ((ts - oldestTs) / timeSpan) * plotW
				if (x - prevLabelX < minSpacingPx) continue
				prevLabelX = x

				const lbl = makeSvgEl("text")
				lbl.setAttribute("x", String(x))
				lbl.setAttribute("y", String(MARGIN.top + plotH + 18))
				lbl.setAttribute("text-anchor", "middle")
				lbl.setAttribute("class", "op-chart-axis-label")
				lbl.textContent = fmtAgo(newestTs - ts)
				svg.appendChild(lbl)
			}

			if (rightEdge - prevLabelX >= minSpacingPx) {
				const nowLbl = makeSvgEl("text")
				nowLbl.setAttribute("x", String(rightEdge))
				nowLbl.setAttribute("y", String(MARGIN.top + plotH + 18))
				nowLbl.setAttribute("text-anchor", "middle")
				nowLbl.setAttribute("class", "op-chart-axis-label")
				nowLbl.textContent = "now"
				svg.appendChild(nowLbl)
			}
		}

		// ── Grouped bars ─────────────────────────────────────────────────────
		const activeMetrics = METRICS.filter((m) => active.has(m.key))
		const numActive = activeMetrics.length
		if (numActive === 0 || pts.length === 0) return

		const n = pts.length
		const groupGap = Math.max(2, Math.min(6, (plotW / n) * 0.15))
		const barGap = 1
		const groupW = plotW / n
		const barW = Math.max(1, (groupW - groupGap - barGap * (numActive - 1)) / numActive)

		for (let gi = 0; gi < pts.length; gi++) {
			const pt = pts[gi]
			if (!pt) continue
			const groupX = MARGIN.left + gi * groupW + groupGap / 2

			for (let mi = 0; mi < activeMetrics.length; mi++) {
				const m = activeMetrics[mi]
				if (!m) continue
				const v = pt.data[m.key]
				const barH = (v / yMax) * plotH
				const x = groupX + mi * (barW + barGap)
				const y = MARGIN.top + plotH - barH

				const rect = makeSvgEl("rect")
				rect.setAttribute("x", String(x))
				rect.setAttribute("y", String(y))
				rect.setAttribute("width", String(barW))
				rect.setAttribute("height", String(Math.max(1, barH)))
				rect.setAttribute("fill", `var(${m.cssVar})`)
				rect.setAttribute("opacity", "0.75")
				rect.setAttribute("rx", "1")
				svg.appendChild(rect)
			}
		}
	}

	function drawLast(): void {
		draw(lastHistory)
	}

	const ro = new ResizeObserver((entries) => {
		const entry = entries[0]
		if (!entry) return
		svgWidth = Math.floor(entry.contentRect.width)
		svgHeight = Math.floor(entry.contentRect.height)
		svg.setAttribute("viewBox", `0 0 ${svgWidth} ${svgHeight}`)
		drawLast()
	})
	ro.observe(svg as unknown as Element)

	return {
		update(history: TimePoint[]): void {
			lastHistory = history
			draw(history)
		},
		destroy(): void {
			ro.disconnect()
			el.remove()
		},
	}
}
