import type { BpmnEditor } from "@bpmnkit/editor"
import type { ValidationConfig } from "./types.js"

export interface ValidationResult {
	passed: boolean
	message: string
}

/** Validate a canvas step. canvasContainer is the rendered SVG container; editor gives model access. */
export function validateStep(
	config: ValidationConfig,
	canvasContainer: HTMLElement | null,
	editor?: BpmnEditor | null,
): ValidationResult {
	if (config.type === "manual") {
		return { passed: true, message: config.successMessage }
	}

	if (!canvasContainer) {
		return { passed: false, message: "Canvas not ready" }
	}

	if (config.type === "bpmnkit-element-count") {
		const defs = editor?.getDefinitions()
		if (!defs) return { passed: false, message: "Canvas not ready" }
		let count = 0
		for (const process of defs.processes) {
			for (const el of process.flowElements) {
				if (el.type === config.elementType) count++
			}
		}
		if (count >= config.min) {
			return { passed: true, message: config.successMessage }
		}
		return { passed: false, message: config.errorMessage }
	}

	if (config.type === "bpmnkit-has-connection") {
		const edges = canvasContainer.querySelectorAll(".bpmnkit-edge")
		if (edges.length > 0) {
			return { passed: true, message: config.successMessage }
		}
		return { passed: false, message: config.errorMessage }
	}

	if (config.type === "bpmnkit-element-labeled") {
		const labels = canvasContainer.querySelectorAll(".bpmnkit-label")
		for (const label of labels) {
			if (label.textContent && label.textContent.trim().length > 0) {
				return { passed: true, message: config.successMessage }
			}
		}
		return { passed: false, message: config.errorMessage }
	}

	return { passed: false, message: "Unknown validation type" }
}
