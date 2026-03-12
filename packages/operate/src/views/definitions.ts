import type { DefinitionsStore } from "../stores/definitions.js"
import type { ProcessDefinitionResult } from "../types.js"

export function createDefinitionsView(
	store: DefinitionsStore,
	onSelect: (def: ProcessDefinitionResult) => void,
): {
	el: HTMLElement
	destroy(): void
} {
	const el = document.createElement("div")
	el.className = "op-view op-def-view"

	// Toolbar
	const toolbar = document.createElement("div")
	toolbar.className = "op-toolbar"
	const searchInput = document.createElement("input")
	searchInput.type = "text"
	searchInput.className = "op-search"
	searchInput.placeholder = "Search processes…"
	toolbar.appendChild(searchInput)
	const countEl = document.createElement("span")
	countEl.className = "op-search-count"
	toolbar.appendChild(countEl)
	el.appendChild(toolbar)

	// Groups container
	const groupsEl = document.createElement("div")
	groupsEl.className = "op-def-groups"
	el.appendChild(groupsEl)

	// Pagination bar
	const paginationEl = document.createElement("div")
	paginationEl.className = "op-pagination"
	el.appendChild(paginationEl)

	// Track collapsed state per processDefinitionId
	const collapsed = new Map<string, boolean>()

	// Sort + pagination state
	let sortField: "name" | "versions" | null = null
	let sortDir: "asc" | "desc" = "asc"
	let currentPage = 0
	const pageSize = 10

	function buildGroups(items: ProcessDefinitionResult[]): Map<string, ProcessDefinitionResult[]> {
		const map = new Map<string, ProcessDefinitionResult[]>()
		for (const item of items) {
			const id = item.processDefinitionId ?? item.processDefinitionKey ?? ""
			const existing = map.get(id)
			if (existing) {
				existing.push(item)
			} else {
				map.set(id, [item])
			}
		}
		// Sort each group by version descending (latest first)
		for (const versions of map.values()) {
			versions.sort((a, b) => (b.version ?? 0) - (a.version ?? 0))
		}
		return map
	}

	function renderPagination(total: number, start: number, end: number, totalPages: number): void {
		paginationEl.innerHTML = ""

		const prevBtn = document.createElement("button")
		prevBtn.className = "op-pagination-btn"
		prevBtn.textContent = "‹"
		prevBtn.disabled = currentPage === 0
		prevBtn.addEventListener("click", () => {
			currentPage--
			render()
		})
		paginationEl.appendChild(prevBtn)

		const infoEl = document.createElement("span")
		infoEl.className = "op-pagination-info"
		infoEl.textContent = total > 0 ? `${start + 1}–${end} of ${total}` : "0 results"
		paginationEl.appendChild(infoEl)

		const nextBtn = document.createElement("button")
		nextBtn.className = "op-pagination-btn"
		nextBtn.textContent = "›"
		nextBtn.disabled = currentPage >= totalPages - 1
		nextBtn.addEventListener("click", () => {
			currentPage++
			render()
		})
		paginationEl.appendChild(nextBtn)
	}

	function makeSortTh(label: string, field: "name" | "versions", style: string): HTMLElement {
		const th = document.createElement("div")
		th.className = "bpmn-table-th op-th-sort"
		th.setAttribute("style", style)
		const labelSpan = document.createElement("span")
		labelSpan.textContent = label
		th.appendChild(labelSpan)
		const icon = document.createElement("span")
		icon.className = "op-sort-icon"
		if (sortField === field) {
			icon.textContent = sortDir === "asc" ? "↑" : "↓"
			icon.classList.add("op-sort-icon--active")
		} else {
			icon.textContent = "↕"
		}
		th.addEventListener("click", () => {
			if (sortField === field) {
				if (sortDir === "asc") {
					sortDir = "desc"
				} else {
					sortField = null
				}
			} else {
				sortField = field
				sortDir = "asc"
			}
			currentPage = 0
			render()
		})
		return th
	}

	function render(): void {
		const items = store.state.data?.items ?? []
		const query = searchInput.value.toLowerCase()

		// Filter
		const filtered = query
			? items.filter(
					(d) =>
						(d.name ?? "").toLowerCase().includes(query) ||
						(d.processDefinitionId ?? "").toLowerCase().includes(query),
				)
			: items

		const groups = buildGroups(filtered)

		// Sort groups
		let groupEntries = Array.from(groups.entries())
		if (sortField !== null) {
			const field = sortField
			const dir = sortDir === "asc" ? 1 : -1
			groupEntries = groupEntries.sort(([, av], [, bv]) => {
				if (field === "name") {
					const an = av[0]?.name ?? ""
					const bn = bv[0]?.name ?? ""
					return an.localeCompare(bn) * dir
				}
				return (av.length - bv.length) * dir
			})
		}

		// Update count
		countEl.textContent = String(groupEntries.length)

		// Pagination
		const total = groupEntries.length
		const totalPages = Math.max(1, Math.ceil(total / pageSize))
		if (currentPage >= totalPages) currentPage = totalPages - 1
		const start = currentPage * pageSize
		const pageEntries = groupEntries.slice(start, start + pageSize)
		const end = start + pageEntries.length

		groupsEl.innerHTML = ""

		if (total === 0) {
			const empty = document.createElement("div")
			empty.className = "bpmn-table-empty"
			empty.textContent = query ? "No results" : "No process definitions deployed"
			groupsEl.appendChild(empty)
			renderPagination(0, 0, 0, 1)
			return
		}

		// Sortable header
		const header = document.createElement("div")
		header.className = "bpmn-table-header op-def-header"
		header.appendChild(makeSortTh("Name", "name", "flex:1"))
		const idTh = document.createElement("div")
		idTh.className = "bpmn-table-th"
		idTh.style.width = "160px"
		idTh.textContent = "ID"
		header.appendChild(idTh)
		header.appendChild(makeSortTh("Versions", "versions", "width:80px"))
		const latestTh = document.createElement("div")
		latestTh.className = "bpmn-table-th"
		latestTh.style.width = "100px"
		latestTh.textContent = "Latest"
		header.appendChild(latestTh)
		groupsEl.appendChild(header)

		for (const [id, versions] of pageEntries) {
			const isCollapsed = collapsed.get(id) ?? true
			const latest = versions[0]
			if (!latest) continue
			const name = latest.name ?? id

			const group = document.createElement("div")
			group.className = "op-def-group"

			// Group header row
			const groupRow = document.createElement("div")
			groupRow.className = "op-def-group-row"

			const chevron = document.createElement("span")
			chevron.className = `op-def-chevron${isCollapsed ? "" : " op-def-chevron--open"}`
			chevron.textContent = "›"
			groupRow.appendChild(chevron)

			const nameEl = document.createElement("span")
			nameEl.className = "op-def-name"
			nameEl.textContent = name
			groupRow.appendChild(nameEl)

			const idEl = document.createElement("span")
			idEl.className = "op-def-group-id"
			idEl.textContent = id
			groupRow.appendChild(idEl)

			const countSpan = document.createElement("span")
			countSpan.className = "op-def-count"
			countSpan.textContent = String(versions.length)
			groupRow.appendChild(countSpan)

			const tagEl = document.createElement("span")
			tagEl.className = "op-def-version-tag"
			tagEl.textContent = latest.versionTag ?? `v${latest.version ?? "?"}`
			groupRow.appendChild(tagEl)

			groupRow.addEventListener("click", () => {
				collapsed.set(id, !collapsed.get(id))
				render()
			})
			group.appendChild(groupRow)

			// Version rows (shown when not collapsed)
			if (!isCollapsed) {
				const versionsEl = document.createElement("div")
				versionsEl.className = "op-def-versions"
				for (const def of versions) {
					const vRow = document.createElement("div")
					vRow.className = "op-def-version-row"

					const vNum = document.createElement("span")
					vNum.className = "op-def-version-num"
					vNum.textContent = `v${def.version ?? "?"}`
					vRow.appendChild(vNum)

					const vTag = document.createElement("span")
					vTag.className = "op-def-version-tag"
					vTag.textContent = def.versionTag ?? ""
					vRow.appendChild(vTag)

					const vKey = document.createElement("span")
					vKey.className = "op-def-version-key"
					vKey.textContent = def.processDefinitionKey ?? ""
					vRow.appendChild(vKey)

					vRow.addEventListener("click", () => onSelect(def))
					versionsEl.appendChild(vRow)
				}
				group.appendChild(versionsEl)
			}

			groupsEl.appendChild(group)
		}

		renderPagination(total, start, end, totalPages)
	}

	searchInput.addEventListener("input", () => {
		currentPage = 0
		render()
	})
	const unsub = store.subscribe(render)
	render()

	return { el, destroy: unsub }
}
