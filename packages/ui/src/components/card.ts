/**
 * Creates a stats card element.
 * @param label - Uppercase label shown below the value.
 * @param value - Primary numeric or text value.
 * @param mod   - Optional modifier: "clickable" | "warn"
 */
export function createStatsCard(label: string, value: number | string, mod?: string): HTMLElement {
	const el = document.createElement("div")
	el.className = `bpmnkit-card${mod ? ` bpmnkit-card--${mod}` : ""}`

	const num = document.createElement("div")
	num.className = "bpmnkit-card-value"
	num.textContent = String(value)

	const lbl = document.createElement("div")
	lbl.className = "bpmnkit-card-label"
	lbl.textContent = label

	el.appendChild(num)
	el.appendChild(lbl)
	return el
}
