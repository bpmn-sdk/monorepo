import type { DecisionsStore } from "../stores/decisions.js"
import type { DecisionDefinitionResult } from "../types.js"

export function createDecisionsView(
	store: DecisionsStore,
	onSelect: (def: DecisionDefinitionResult) => void,
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
	searchInput.placeholder = "Search decisions…"
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

	const collapsed = new Map<string, boolean>()
	let currentPage = 0
	const pageSize = 10

	/**
	 * Group decisions by their DRG ID (decisionRequirementsId).
	 * Standalone decisions (no DRG) use their own decisionDefinitionId as the group key.
	 */
	function buildGroups(
		items: DecisionDefinitionResult[],
	): Map<string, { drgName: string; decisions: Map<string, DecisionDefinitionResult[]> }> {
		const map = new Map<
			string,
			{ drgName: string; decisions: Map<string, DecisionDefinitionResult[]> }
		>()
		for (const item of items) {
			const groupKey = item.decisionRequirementsId ?? item.decisionDefinitionId
			const drgName = item.decisionRequirementsName ?? item.decisionDefinitionId
			const existing = map.get(groupKey)
			if (!existing) {
				map.set(groupKey, { drgName, decisions: new Map() })
			}
			const group = map.get(groupKey)
			if (!group) continue
			const defVersions = group.decisions.get(item.decisionDefinitionId)
			if (defVersions) {
				defVersions.push(item)
			} else {
				group.decisions.set(item.decisionDefinitionId, [item])
			}
		}
		// Sort each decision's versions descending
		for (const { decisions } of map.values()) {
			for (const versions of decisions.values()) {
				versions.sort((a, b) => (b.version ?? 0) - (a.version ?? 0))
			}
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

	function render(): void {
		const items = store.state.data?.items ?? []
		const query = searchInput.value.toLowerCase()

		const filtered = query
			? items.filter(
					(d) =>
						d.name.toLowerCase().includes(query) ||
						d.decisionDefinitionId.toLowerCase().includes(query) ||
						(d.decisionRequirementsName ?? "").toLowerCase().includes(query),
				)
			: items

		const groups = buildGroups(filtered)
		const groupEntries = Array.from(groups.entries())

		countEl.textContent = String(groupEntries.length)

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
			empty.textContent = query ? "No results" : "No decision definitions deployed"
			groupsEl.appendChild(empty)
			renderPagination(0, 0, 0, 1)
			return
		}

		// Header
		const header = document.createElement("div")
		header.className = "bpmn-table-header op-def-header"
		const nameTh = document.createElement("div")
		nameTh.className = "bpmn-table-th"
		nameTh.style.flex = "1"
		nameTh.textContent = "Name"
		header.appendChild(nameTh)
		const idTh = document.createElement("div")
		idTh.className = "bpmn-table-th"
		idTh.style.width = "160px"
		idTh.textContent = "ID"
		header.appendChild(idTh)
		const verTh = document.createElement("div")
		verTh.className = "bpmn-table-th"
		verTh.style.width = "80px"
		verTh.textContent = "Decisions"
		header.appendChild(verTh)
		const latestTh = document.createElement("div")
		latestTh.className = "bpmn-table-th"
		latestTh.style.width = "70px"
		latestTh.textContent = "Version"
		header.appendChild(latestTh)
		groupsEl.appendChild(header)

		for (const [groupKey, { drgName, decisions }] of pageEntries) {
			const isCollapsed = collapsed.get(groupKey) ?? true

			const group = document.createElement("div")
			group.className = "op-def-group"

			const groupRow = document.createElement("div")
			groupRow.className = "op-def-group-row"

			const chevron = document.createElement("span")
			chevron.className = `op-def-chevron${isCollapsed ? "" : " op-def-chevron--open"}`
			chevron.textContent = "›"
			groupRow.appendChild(chevron)

			const nameEl = document.createElement("span")
			nameEl.className = "op-def-name"
			nameEl.textContent = drgName
			groupRow.appendChild(nameEl)

			const idEl = document.createElement("span")
			idEl.className = "op-def-group-id"
			idEl.textContent = groupKey
			groupRow.appendChild(idEl)

			const countSpan = document.createElement("span")
			countSpan.className = "op-def-count"
			countSpan.textContent = String(decisions.size)
			groupRow.appendChild(countSpan)

			// Show max version in the group
			let maxVersion = 0
			for (const versions of decisions.values()) {
				const v = versions[0]?.version ?? 0
				if (v > maxVersion) maxVersion = v
			}
			const tagEl = document.createElement("span")
			tagEl.className = "op-def-version-tag"
			tagEl.textContent = `v${maxVersion}`
			groupRow.appendChild(tagEl)

			groupRow.addEventListener("click", () => {
				collapsed.set(groupKey, !collapsed.get(groupKey))
				render()
			})
			group.appendChild(groupRow)

			if (!isCollapsed) {
				const decisionsEl = document.createElement("div")
				decisionsEl.className = "op-def-versions"

				for (const [defId, versions] of decisions) {
					// Sub-row header for this decision
					const defHeader = document.createElement("div")
					defHeader.className = "op-dec-def-header"
					defHeader.textContent = versions[0]?.name ?? defId
					decisionsEl.appendChild(defHeader)

					for (const def of versions) {
						const vRow = document.createElement("div")
						vRow.className = "op-def-version-row"

						const vNum = document.createElement("span")
						vNum.className = "op-def-version-num"
						vNum.textContent = `v${def.version ?? "?"}`
						vRow.appendChild(vNum)

						const vKey = document.createElement("span")
						vKey.className = "op-def-version-key"
						vKey.textContent = def.decisionDefinitionKey
						vRow.appendChild(vKey)

						vRow.addEventListener("click", () => onSelect(def))
						decisionsEl.appendChild(vRow)
					}
				}

				group.appendChild(decisionsEl)
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
