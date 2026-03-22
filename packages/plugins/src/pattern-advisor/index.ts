import type { CanvasApi, CanvasPlugin } from "@bpmnkit/canvas"
import { optimize } from "@bpmnkit/core"
import type { BpmnDefinitions, OptimizationFinding } from "@bpmnkit/core"
import { injectPatternAdvisorStyles } from "./css.js"

// ── Public API ──────────────────────────────────────────────────────────────

export interface PatternAdvisorOptions {
	/** Container element to mount the advisor panel into. */
	container?: HTMLElement
	/**
	 * Called when a fix is applied. Use this to re-serialize and reload the
	 * modified definitions (e.g. serialize to XML and call `canvas.load(xml)`).
	 */
	onApplyFix?: (defs: BpmnDefinitions, description: string) => void
}

export interface PatternAdvisorPlugin extends CanvasPlugin {
	readonly name: "pattern-advisor"
	/** The side-panel element. Mount it in your dock or sidebar. */
	readonly panel: HTMLElement
	/** Mount the panel into a container element. */
	mount(container: HTMLElement): void
}

// ── Plugin factory ──────────────────────────────────────────────────────────

export function createPatternAdvisorPlugin(options?: PatternAdvisorOptions): PatternAdvisorPlugin {
	let canvasApi: CanvasApi | null = null
	let currentDefs: BpmnDefinitions | null = null
	let findings: OptimizationFinding[] = []
	const dismissed = new Set<string>() // finding IDs dismissed by user
	const unsubs: Array<() => void> = []

	// ── Panel DOM ───────────────────────────────────────────────────────────

	const panelEl = document.createElement("div")
	panelEl.className = "bpmnkit-pa-panel"

	const headerEl = document.createElement("div")
	headerEl.className = "bpmnkit-pa-header"

	const titleEl = document.createElement("span")
	titleEl.className = "bpmnkit-pa-title"
	titleEl.textContent = "Pattern Advisor"

	const countsEl = document.createElement("div")
	countsEl.className = "bpmnkit-pa-counts"

	headerEl.appendChild(titleEl)
	headerEl.appendChild(countsEl)

	const bodyEl = document.createElement("div")
	bodyEl.className = "bpmnkit-pa-body"

	panelEl.appendChild(headerEl)
	panelEl.appendChild(bodyEl)

	// ── Helpers ─────────────────────────────────────────────────────────────

	function clearEl(el: HTMLElement): void {
		while (el.firstChild !== null) el.removeChild(el.firstChild)
	}

	function makeBadge(severity: string): HTMLSpanElement {
		const badge = document.createElement("span")
		badge.className = `bpmnkit-pa-badge bpmnkit-pa-badge-${severity}`
		badge.textContent = severity.toUpperCase()
		return badge
	}

	function makeSeverityTag(severity: string): HTMLSpanElement {
		const tag = document.createElement("span")
		tag.className = `bpmnkit-pa-severity bpmnkit-pa-severity-${severity}`
		tag.textContent = severity
		return tag
	}

	// ── Canvas badge management ─────────────────────────────────────────────

	const BADGE_CLASSES = [
		"bpmnkit-pa-error-ring",
		"bpmnkit-pa-warning-ring",
		"bpmnkit-pa-info-ring",
	] as const

	function clearCanvasBadges(): void {
		const vp = canvasApi?.viewportEl
		if (vp === undefined) return
		for (const cls of BADGE_CLASSES) {
			for (const el of vp.querySelectorAll(`.${cls}`)) {
				el.classList.remove(cls)
			}
		}
	}

	function applyCanvasBadges(activeFindings: OptimizationFinding[]): void {
		const vp = canvasApi?.viewportEl
		if (vp === undefined) return
		clearCanvasBadges()

		// Track the worst severity per element
		const worstSeverity = new Map<string, "error" | "warning" | "info">()
		for (const f of activeFindings) {
			for (const id of f.elementIds) {
				const current = worstSeverity.get(id)
				if (
					current === undefined ||
					(f.severity === "error" && current !== "error") ||
					(f.severity === "warning" && current === "info")
				) {
					worstSeverity.set(id, f.severity)
				}
			}
		}

		for (const [elementId, severity] of worstSeverity) {
			const el = vp.querySelector(`[data-bpmnkit-id="${elementId}"]`)
			if (el !== null) {
				el.classList.add(`bpmnkit-pa-${severity}-ring`)
			}
		}
	}

	// ── Rendering ───────────────────────────────────────────────────────────

	function renderPanel(): void {
		clearEl(countsEl)
		clearEl(bodyEl)

		const active = findings.filter((f) => !dismissed.has(f.id))

		if (active.length === 0) {
			const empty = document.createElement("div")
			empty.className = "bpmnkit-pa-empty"
			empty.textContent =
				currentDefs === null
					? "Open a process to see pattern suggestions."
					: "No pattern issues found. The process looks good."
			bodyEl.appendChild(empty)
			clearEl(countsEl)
			return
		}

		// Summary badges
		const errors = active.filter((f) => f.severity === "error").length
		const warnings = active.filter((f) => f.severity === "warning").length
		const infos = active.filter((f) => f.severity === "info").length
		if (errors > 0) {
			const b = makeBadge("error")
			b.textContent = String(errors)
			countsEl.appendChild(b)
		}
		if (warnings > 0) {
			const b = makeBadge("warning")
			b.textContent = String(warnings)
			countsEl.appendChild(b)
		}
		if (infos > 0) {
			const b = makeBadge("info")
			b.textContent = String(infos)
			countsEl.appendChild(b)
		}

		// Group findings by first elementId (or processId if empty)
		const groups = new Map<string, OptimizationFinding[]>()
		for (const f of active) {
			const groupKey = f.elementIds[0] ?? f.processId
			const arr = groups.get(groupKey) ?? []
			arr.push(f)
			groups.set(groupKey, arr)
		}

		// Sort groups: errors first, then warnings, then info
		const severityOrder = { error: 0, warning: 1, info: 2 } as const
		const sortedGroups = [...groups.entries()].sort(([, a], [, b]) => {
			const aMin = Math.min(...a.map((f) => severityOrder[f.severity]))
			const bMin = Math.min(...b.map((f) => severityOrder[f.severity]))
			return aMin - bMin
		})

		for (const [groupKey, groupFindings] of sortedGroups) {
			const groupEl = document.createElement("div")
			groupEl.className = "bpmnkit-pa-group"

			const groupHeader = document.createElement("div")
			groupHeader.className = "bpmnkit-pa-group-header"
			groupHeader.textContent = groupKey
			groupEl.appendChild(groupHeader)

			// Sort within group: errors first
			const sorted = [...groupFindings].sort(
				(a, b) => severityOrder[a.severity] - severityOrder[b.severity],
			)

			for (const finding of sorted) {
				const findingEl = document.createElement("div")
				findingEl.className = "bpmnkit-pa-finding"

				findingEl.appendChild(makeSeverityTag(finding.severity))

				const bodyDiv = document.createElement("div")
				bodyDiv.className = "bpmnkit-pa-finding-body"

				const msgEl = document.createElement("div")
				msgEl.className = "bpmnkit-pa-finding-msg"
				msgEl.textContent = finding.message

				const sugEl = document.createElement("div")
				sugEl.className = "bpmnkit-pa-finding-sug"
				sugEl.textContent = finding.suggestion

				bodyDiv.appendChild(msgEl)
				bodyDiv.appendChild(sugEl)

				// Action buttons
				const actionsEl = document.createElement("div")
				actionsEl.className = "bpmnkit-pa-finding-actions"

				if (finding.applyFix !== undefined && currentDefs !== null) {
					const fixBtn = document.createElement("button")
					fixBtn.className = "bpmnkit-pa-btn bpmnkit-pa-btn-fix"
					fixBtn.textContent = "Apply Fix"
					const defs = currentDefs
					const fix = finding.applyFix
					fixBtn.addEventListener("click", () => {
						const result = fix(defs)
						options?.onApplyFix?.(defs, result.description)
					})
					actionsEl.appendChild(fixBtn)
				}

				const dismissBtn = document.createElement("button")
				dismissBtn.className = "bpmnkit-pa-btn"
				dismissBtn.textContent = "Dismiss"
				dismissBtn.addEventListener("click", () => {
					dismissed.add(finding.id)
					renderPanel()
					applyCanvasBadges(findings.filter((f) => !dismissed.has(f.id)))
				})
				actionsEl.appendChild(dismissBtn)

				bodyDiv.appendChild(actionsEl)
				findingEl.appendChild(bodyDiv)
				groupEl.appendChild(findingEl)
			}

			bodyEl.appendChild(groupEl)
		}
	}

	// ── Analysis ────────────────────────────────────────────────────────────

	function runAnalysis(defs: BpmnDefinitions): void {
		currentDefs = defs
		const report = optimize(defs, { categories: ["pattern"] })
		findings = report.findings
		renderPanel()
		applyCanvasBadges(findings.filter((f) => !dismissed.has(f.id)))
	}

	function clearAnalysis(): void {
		currentDefs = null
		findings = []
		clearCanvasBadges()
		renderPanel()
	}

	// ── CanvasPlugin ────────────────────────────────────────────────────────

	return {
		name: "pattern-advisor",

		panel: panelEl,

		mount(container: HTMLElement): void {
			container.appendChild(panelEl)
		},

		install(api: CanvasApi): void {
			canvasApi = api
			injectPatternAdvisorStyles()
			renderPanel()

			if (options?.container !== undefined) {
				options.container.appendChild(panelEl)
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
		},

		uninstall(): void {
			for (const off of unsubs) off()
			clearCanvasBadges()
			panelEl.remove()
			canvasApi = null
		},
	}
}
