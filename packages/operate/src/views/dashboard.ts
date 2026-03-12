import { IC_UI } from "@bpmn-sdk/ui"
import { createLineChart } from "../components/chart.js"
import type { DashboardStore } from "../stores/dashboard.js"

// ── Dashboard card ────────────────────────────────────────────────────────────

function createDashboardCard(
	label: string,
	value: number | string,
	icon: string,
	accent: string,
	onClick: () => void,
): HTMLElement {
	const card = document.createElement("div")
	card.className = "op-dash-card"
	card.style.setProperty("--accent", accent)

	const top = document.createElement("div")
	top.className = "op-dash-card-top"

	const lbl = document.createElement("div")
	lbl.className = "op-dash-card-label"
	lbl.textContent = label

	const iconWrap = document.createElement("div")
	iconWrap.className = "op-dash-card-icon"
	iconWrap.innerHTML = icon

	top.appendChild(lbl)
	top.appendChild(iconWrap)
	card.appendChild(top)

	const val = document.createElement("div")
	val.className = "op-dash-card-value"
	val.textContent = String(value)
	card.appendChild(val)

	card.addEventListener("click", onClick)
	return card
}

// ── View ──────────────────────────────────────────────────────────────────────

export function createDashboardView(
	store: DashboardStore,
	onNavigate: (path: string) => void,
): {
	el: HTMLElement
	destroy(): void
} {
	const el = document.createElement("div")
	el.className = "op-view op-dashboard"

	const grid = document.createElement("div")
	grid.className = "op-card-grid"
	el.appendChild(grid)

	const chartWrap = document.createElement("div")
	chartWrap.className = "op-chart-section"

	const chartHeading = document.createElement("div")
	chartHeading.className = "op-chart-heading"
	chartHeading.textContent = "Activity over time"
	chartWrap.appendChild(chartHeading)

	el.appendChild(chartWrap)
	const chart = createLineChart(chartWrap)

	function render(): void {
		grid.innerHTML = ""
		const d = store.state.data

		grid.appendChild(
			createDashboardCard(
				"Active Instances",
				d?.activeInstances ?? "—",
				IC_UI.instances,
				"var(--bpmn-accent)",
				() => onNavigate("/instances"),
			),
		)

		// Incidents: use amber accent when there are open incidents
		const incAccent = d?.openIncidents ? "var(--op-c-amber)" : "var(--bpmn-accent)"
		grid.appendChild(
			createDashboardCard(
				"Open Incidents",
				d?.openIncidents ?? "—",
				IC_UI.incidents,
				incAccent,
				() => onNavigate("/incidents"),
			),
		)

		grid.appendChild(
			createDashboardCard(
				"Active Jobs",
				d?.activeJobs ?? "—",
				IC_UI.jobs,
				"var(--op-c-green)",
				() => onNavigate("/jobs"),
			),
		)

		grid.appendChild(
			createDashboardCard(
				"Pending Tasks",
				d?.pendingTasks ?? "—",
				IC_UI.tasks,
				"var(--op-c-purple)",
				() => onNavigate("/tasks"),
			),
		)

		grid.appendChild(
			createDashboardCard(
				"Deployed Processes",
				d?.definitions ?? "—",
				IC_UI.processes,
				"var(--bpmn-fg-muted)",
				() => onNavigate("/definitions"),
			),
		)

		chart.update(store.history)
	}

	const unsub = store.subscribe(render)
	render()

	return {
		el,
		destroy(): void {
			unsub()
			chart.destroy()
		},
	}
}
