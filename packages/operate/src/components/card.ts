export function createStatsCard(label: string, value: number | string, mod?: string): HTMLElement {
	const el = document.createElement("div")
	el.className = `op-card${mod ? ` op-card--${mod}` : ""}`

	const num = document.createElement("div")
	num.className = "op-card-value"
	num.textContent = String(value)

	const lbl = document.createElement("div")
	lbl.className = "op-card-label"
	lbl.textContent = label

	el.appendChild(num)
	el.appendChild(lbl)
	return el
}
