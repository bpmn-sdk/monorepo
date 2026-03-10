import { badge } from "../components/badge.js"
import { createTable } from "../components/table.js"
import type { JobsStore } from "../stores/jobs.js"
import type { JobSearchResult } from "../types.js"

export function createJobsView(store: JobsStore): {
	el: HTMLElement
	destroy(): void
} {
	const el = document.createElement("div")
	el.className = "op-view"

	const { el: tableEl, setRows } = createTable<JobSearchResult>({
		columns: [
			{
				label: "Key",
				width: "120px",
				render: (row) => row.jobKey,
			},
			{
				label: "Type",
				render: (row) => row.type,
			},
			{
				label: "Worker",
				width: "160px",
				render: (row) => row.worker || "—",
			},
			{
				label: "Retries",
				width: "70px",
				render: (row) => String(row.retries),
			},
			{
				label: "State",
				width: "120px",
				render: (row) => badge(row.state),
			},
			{
				label: "Error",
				width: "200px",
				render: (row) => {
					const span = document.createElement("span")
					span.className = "op-cell-error"
					span.title = row.errorMessage ?? ""
					span.textContent = row.errorMessage ?? "—"
					return span
				},
			},
		],
		emptyText: "No jobs found",
	})
	el.appendChild(tableEl)

	function render(): void {
		setRows(store.state.data?.items ?? [])
	}

	const unsub = store.subscribe(render)
	render()

	return { el, destroy: unsub }
}
