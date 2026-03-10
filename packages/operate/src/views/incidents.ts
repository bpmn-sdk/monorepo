import { badge } from "../components/badge.js"
import { createTable } from "../components/table.js"
import type { IncidentsStore } from "../stores/incidents.js"
import type { IncidentResult } from "../types.js"

function relTime(iso: string | null | undefined): string {
	if (!iso) return "—"
	const diff = Date.now() - new Date(iso).getTime()
	const m = Math.floor(diff / 60_000)
	if (m < 1) return "just now"
	if (m < 60) return `${m}m ago`
	const h = Math.floor(m / 60)
	if (h < 24) return `${h}h ago`
	return `${Math.floor(h / 24)}d ago`
}

export function createIncidentsView(store: IncidentsStore): {
	el: HTMLElement
	destroy(): void
} {
	const el = document.createElement("div")
	el.className = "op-view"

	const { el: tableEl, setRows } = createTable<IncidentResult>({
		columns: [
			{
				label: "Type",
				width: "180px",
				render: (row) => row.errorType ?? "UNKNOWN",
			},
			{
				label: "Message",
				render: (row) => {
					const span = document.createElement("span")
					span.className = "op-incident-msg-cell"
					span.title = row.errorMessage ?? ""
					span.textContent = row.errorMessage ?? "—"
					return span
				},
			},
			{
				label: "Process",
				width: "180px",
				render: (row) => row.processDefinitionId ?? "—",
			},
			{
				label: "Instance",
				width: "140px",
				render: (row) => row.processInstanceKey ?? "—",
			},
			{
				label: "State",
				width: "100px",
				render: (row) => badge(row.state ?? "UNKNOWN"),
			},
			{
				label: "Created",
				width: "100px",
				render: (row) => relTime(row.creationTime),
			},
		],
		emptyText: "No incidents",
	})
	el.appendChild(tableEl)

	function render(): void {
		setRows(store.state.data?.items ?? [])
	}

	const unsub = store.subscribe(render)
	render()

	return { el, destroy: unsub }
}
