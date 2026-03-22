import type { CanvasApi, CanvasPlugin } from "@bpmnkit/canvas"
import { optimize } from "@bpmnkit/core"
import type { BpmnDefinitions } from "@bpmnkit/core"
import { injectVariableFlowStyles } from "./css.js"

// ── Types ────────────────────────────────────────────────────────────────────

export interface VariableFlowOptions {
	/** Container element to mount the legend into. */
	container?: HTMLElement
}

export interface VariableFlowPlugin extends CanvasPlugin {
	readonly name: "variable-flow"
	/** Legend element showing the color key. */
	readonly legend: HTMLElement
}

// ── Plugin factory ────────────────────────────────────────────────────────────

export function createVariableFlowPlugin(options?: VariableFlowOptions): VariableFlowPlugin {
	let canvasApi: CanvasApi | null = null
	const unsubs: Array<() => void> = []

	// Per-element role maps derived from data-flow/role findings
	const elementProduces = new Map<string, string[]>()
	const elementConsumes = new Map<string, string[]>()
	// Per-edge scope map derived from data-flow/edge-scope findings
	const edgeScope = new Map<string, string[]>()

	// ── Tooltip ──────────────────────────────────────────────────────────────

	const tooltipEl = document.createElement("div")
	tooltipEl.className = "bpmnkit-vf-tooltip"
	tooltipEl.style.display = "none"
	document.body.appendChild(tooltipEl)

	function showTooltip(elementId: string, x: number, y: number): void {
		const produces = elementProduces.get(elementId)
		const consumes = elementConsumes.get(elementId)
		const scope = edgeScope.get(elementId)

		const hasRoleData =
			(produces !== undefined && produces.length > 0) ||
			(consumes !== undefined && consumes.length > 0)
		const hasScopeData = scope !== undefined && scope.length > 0

		if (!hasRoleData && !hasScopeData) {
			hideTooltip()
			return
		}

		while (tooltipEl.firstChild !== null) tooltipEl.removeChild(tooltipEl.firstChild)

		const title = document.createElement("div")
		title.className = "bpmnkit-vf-tooltip-title"
		tooltipEl.appendChild(title)

		if (hasScopeData && scope !== undefined) {
			title.textContent = "Variables in scope"
			for (const v of scope) {
				const row = document.createElement("div")
				row.className = "bpmnkit-vf-tooltip-row"
				const dot = document.createElement("span")
				dot.className = "bpmnkit-vf-tooltip-role bpmnkit-vf-tooltip-role-reads"
				const label = document.createElement("span")
				label.textContent = v
				row.appendChild(dot)
				row.appendChild(label)
				tooltipEl.appendChild(row)
			}
		} else {
			title.textContent = "Variable Flow"
			if (produces !== undefined) {
				for (const v of produces) {
					const row = document.createElement("div")
					row.className = "bpmnkit-vf-tooltip-row"
					const dot = document.createElement("span")
					dot.className = "bpmnkit-vf-tooltip-role bpmnkit-vf-tooltip-role-writes"
					const label = document.createElement("span")
					label.textContent = `writes  ${v}`
					row.appendChild(dot)
					row.appendChild(label)
					tooltipEl.appendChild(row)
				}
			}
			if (consumes !== undefined) {
				for (const v of consumes) {
					const row = document.createElement("div")
					row.className = "bpmnkit-vf-tooltip-row"
					const dot = document.createElement("span")
					dot.className = "bpmnkit-vf-tooltip-role bpmnkit-vf-tooltip-role-reads"
					const label = document.createElement("span")
					label.textContent = `reads   ${v}`
					row.appendChild(dot)
					row.appendChild(label)
					tooltipEl.appendChild(row)
				}
			}
		}

		tooltipEl.style.display = "block"
		const rect = tooltipEl.getBoundingClientRect()
		const left = Math.min(x + 12, window.innerWidth - rect.width - 8)
		const top = Math.min(y + 12, window.innerHeight - rect.height - 8)
		tooltipEl.style.left = `${left}px`
		tooltipEl.style.top = `${top}px`
	}

	function hideTooltip(): void {
		tooltipEl.style.display = "none"
	}

	// ── Legend ────────────────────────────────────────────────────────────────

	const legendEl = document.createElement("div")
	legendEl.className = "bpmnkit-vf-legend"

	function makeLegendItem(dotClass: string, label: string): HTMLElement {
		const item = document.createElement("div")
		item.className = "bpmnkit-vf-legend-item"
		const dot = document.createElement("span")
		dot.className = `bpmnkit-vf-legend-dot ${dotClass}`
		const text = document.createElement("span")
		text.textContent = label
		item.appendChild(dot)
		item.appendChild(text)
		return item
	}

	legendEl.appendChild(makeLegendItem("bpmnkit-vf-legend-dot-writes", "Writes"))
	legendEl.appendChild(makeLegendItem("bpmnkit-vf-legend-dot-reads", "Reads"))
	legendEl.appendChild(makeLegendItem("bpmnkit-vf-legend-dot-both", "Reads & writes"))

	// ── Canvas overlay management ─────────────────────────────────────────────

	const ROLE_CLASSES = ["bpmnkit-vf-producer", "bpmnkit-vf-consumer", "bpmnkit-vf-both"] as const

	function clearOverlays(): void {
		const vp = canvasApi?.viewportEl
		if (vp === undefined) return
		for (const cls of ROLE_CLASSES) {
			for (const el of vp.querySelectorAll(`.${cls}`)) {
				el.classList.remove(cls)
			}
		}
	}

	function applyOverlays(): void {
		const vp = canvasApi?.viewportEl
		if (vp === undefined) return
		clearOverlays()

		const allIds = new Set([...elementProduces.keys(), ...elementConsumes.keys()])
		for (const elementId of allIds) {
			const writes = (elementProduces.get(elementId)?.length ?? 0) > 0
			const reads = (elementConsumes.get(elementId)?.length ?? 0) > 0
			if (!writes && !reads) continue

			const el = vp.querySelector(`[data-bpmnkit-id="${elementId}"]`)
			if (el === null) continue

			if (writes && reads) {
				el.classList.add("bpmnkit-vf-both")
			} else if (writes) {
				el.classList.add("bpmnkit-vf-producer")
			} else {
				el.classList.add("bpmnkit-vf-consumer")
			}
		}
	}

	// ── Analysis ──────────────────────────────────────────────────────────────

	function runAnalysis(defs: BpmnDefinitions): void {
		elementProduces.clear()
		elementConsumes.clear()
		edgeScope.clear()

		const report = optimize(defs, { categories: ["data-flow"] })
		for (const finding of report.findings) {
			const elementId = finding.elementIds[0]
			if (elementId === undefined) continue

			if (finding.id.startsWith("data-flow/role:")) {
				if (finding.produces !== undefined && finding.produces.length > 0) {
					elementProduces.set(elementId, finding.produces)
				}
				if (finding.consumes !== undefined && finding.consumes.length > 0) {
					elementConsumes.set(elementId, finding.consumes)
				}
			} else if (finding.id.startsWith("data-flow/edge-scope:")) {
				if (finding.produces !== undefined && finding.produces.length > 0) {
					edgeScope.set(elementId, finding.produces)
				}
			}
		}

		applyOverlays()
	}

	function clearAnalysis(): void {
		elementProduces.clear()
		elementConsumes.clear()
		edgeScope.clear()
		clearOverlays()
	}

	// ── Hover wiring ──────────────────────────────────────────────────────────

	function onMouseMove(e: MouseEvent): void {
		const target = (e.target as Element).closest("[data-bpmnkit-id]")
		if (target === null) {
			hideTooltip()
			return
		}
		const elementId = target.getAttribute("data-bpmnkit-id")
		if (elementId === null) {
			hideTooltip()
			return
		}
		showTooltip(elementId, e.clientX, e.clientY)
	}

	function onMouseLeave(): void {
		hideTooltip()
	}

	// ── CanvasPlugin ──────────────────────────────────────────────────────────

	return {
		name: "variable-flow",

		legend: legendEl,

		install(api: CanvasApi): void {
			canvasApi = api
			injectVariableFlowStyles()

			if (options?.container !== undefined) {
				options.container.appendChild(legendEl)
			}

			type AnyOn = (event: string, handler: (arg: unknown) => void) => () => void
			const onAny = api.on as unknown as AnyOn

			unsubs.push(
				api.on("diagram:load", (defs) => {
					runAnalysis(defs)
				}),
				api.on("diagram:clear", () => {
					clearAnalysis()
				}),
				onAny("diagram:change", (defs: unknown) => {
					runAnalysis(defs as BpmnDefinitions)
				}),
			)

			const vp = api.viewportEl
			if (vp !== undefined) {
				vp.addEventListener("mousemove", onMouseMove)
				vp.addEventListener("mouseleave", onMouseLeave)
				unsubs.push(() => {
					vp.removeEventListener("mousemove", onMouseMove)
					vp.removeEventListener("mouseleave", onMouseLeave)
				})
			}
		},

		uninstall(): void {
			for (const off of unsubs) off()
			clearOverlays()
			tooltipEl.remove()
			canvasApi = null
		},
	}
}
