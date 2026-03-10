/** Returns a status badge element for process/incident/job/task states. */
export function badge(state: string): HTMLElement {
	const el = document.createElement("span")
	el.className = `op-badge op-badge--${state.toLowerCase()}`
	el.textContent = state
	return el
}

/** Returns a plain text cell. */
export function cell(text: string | null | undefined): HTMLElement {
	const el = document.createElement("span")
	el.className = "op-cell-text"
	el.textContent = text ?? "—"
	return el
}
