export interface FilterColumn<T> {
	label: string
	width?: string
	render(row: T): string | HTMLElement
	/** If provided, column header becomes clickable for sort */
	sortValue?: (row: T) => string | number | null | undefined
}

export function createFilterTable<T>(options: {
	columns: FilterColumn<T>[]
	/** Function returning searchable text for a row */
	searchFn?: (row: T) => string
	onRowClick?: (row: T) => void
	emptyText?: string
}): {
	el: HTMLElement
	setRows(rows: T[]): void
} {
	let allRows: T[] = []
	let searchQuery = ""
	let sortState: { col: number; dir: "asc" | "desc" } | null = null

	const el = document.createElement("div")
	el.className = "op-filter-table"

	// Toolbar row: search input + count
	const toolbar = document.createElement("div")
	toolbar.className = "op-toolbar"

	const searchInput = document.createElement("input")
	searchInput.type = "text"
	searchInput.className = "op-search"
	searchInput.placeholder = "Search…"
	toolbar.appendChild(searchInput)

	const countEl = document.createElement("span")
	countEl.className = "op-search-count"
	toolbar.appendChild(countEl)
	el.appendChild(toolbar)

	// Table wrap
	const tableWrap = document.createElement("div")
	tableWrap.className = "bpmn-table-wrap"
	el.appendChild(tableWrap)

	// Header with sort support
	const headerEl = document.createElement("div")
	headerEl.className = "bpmn-table-header"
	const headerCells: HTMLElement[] = []

	for (let i = 0; i < options.columns.length; i++) {
		const col = options.columns[i]
		if (!col) continue
		const th = document.createElement("div")
		th.className = "bpmn-table-th"
		if (col.width) th.style.width = col.width

		if (col.sortValue) {
			th.classList.add("op-th-sort")
			const labelSpan = document.createElement("span")
			labelSpan.textContent = col.label
			th.appendChild(labelSpan)
			const icon = document.createElement("span")
			icon.className = "op-sort-icon"
			icon.textContent = "↕"
			th.appendChild(icon)
			const idx = i
			th.addEventListener("click", () => {
				if (sortState?.col === idx) {
					sortState = sortState.dir === "asc" ? { col: idx, dir: "desc" } : null
				} else {
					sortState = { col: idx, dir: "asc" }
				}
				updateSortIcons()
				renderRows()
			})
		} else {
			th.textContent = col.label
		}
		headerCells.push(th)
		headerEl.appendChild(th)
	}
	tableWrap.appendChild(headerEl)

	const bodyEl = document.createElement("div")
	bodyEl.className = "bpmn-table-body"
	tableWrap.appendChild(bodyEl)

	function updateSortIcons(): void {
		for (let i = 0; i < headerCells.length; i++) {
			const icon = headerCells[i]?.querySelector(".op-sort-icon")
			if (!icon) continue
			if (sortState?.col === i) {
				icon.textContent = sortState.dir === "asc" ? "↑" : "↓"
				icon.classList.add("op-sort-icon--active")
			} else {
				icon.textContent = "↕"
				icon.classList.remove("op-sort-icon--active")
			}
		}
	}

	function applyFilterSort(): T[] {
		let rows = allRows
		if (searchQuery && options.searchFn) {
			const q = searchQuery.toLowerCase()
			rows = rows.filter((row) => options.searchFn?.(row).toLowerCase().includes(q))
		}
		if (sortState !== null) {
			const st = sortState
			const col = options.columns[st.col]
			if (col?.sortValue) {
				const dir = st.dir === "asc" ? 1 : -1
				rows = [...rows].sort((a, b) => {
					const av = col.sortValue?.(a) ?? ""
					const bv = col.sortValue?.(b) ?? ""
					if (av < bv) return -1 * dir
					if (av > bv) return 1 * dir
					return 0
				})
			}
		}
		return rows
	}

	function renderRows(): void {
		const filtered = applyFilterSort()
		countEl.textContent =
			filtered.length !== allRows.length
				? `${filtered.length} / ${allRows.length}`
				: String(allRows.length)
		bodyEl.innerHTML = ""
		if (filtered.length === 0) {
			const empty = document.createElement("div")
			empty.className = "bpmn-table-empty"
			empty.textContent = searchQuery ? "No results" : (options.emptyText ?? "No data")
			bodyEl.appendChild(empty)
			return
		}
		for (const row of filtered) {
			const tr = document.createElement("div")
			tr.className = "bpmn-table-row"
			if (options.onRowClick) {
				tr.classList.add("bpmn-table-row--clickable")
				tr.addEventListener("click", () => options.onRowClick?.(row))
			}
			for (const col of options.columns) {
				const td = document.createElement("div")
				td.className = "bpmn-table-td"
				if (col.width) td.style.width = col.width
				const content = col.render(row)
				if (typeof content === "string") td.textContent = content
				else td.appendChild(content)
				tr.appendChild(td)
			}
			bodyEl.appendChild(tr)
		}
	}

	searchInput.addEventListener("input", () => {
		searchQuery = searchInput.value
		renderRows()
	})

	return {
		el,
		setRows(rows: T[]): void {
			allRows = rows
			renderRows()
		},
	}
}
