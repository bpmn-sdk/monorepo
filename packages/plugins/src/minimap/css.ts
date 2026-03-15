/** ID used to prevent duplicate style injection. */
export const MINIMAP_STYLE_ID = "bpmnkit-minimap-styles-v1"

/** CSS for the minimap plugin, injected once into `<head>`. */
export const MINIMAP_CSS = `
.bpmnkit-minimap {
  position: absolute;
  bottom: 12px;
  right: 12px;
  width: 160px;
  height: 100px;
  background: var(--bpmnkit-overlay-bg, rgba(248, 249, 250, 0.92));
  border: 1px solid var(--bpmnkit-overlay-border, rgba(0, 0, 0, 0.12));
  border-radius: 6px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
  cursor: crosshair;
}
.bpmnkit-minimap > svg {
  display: block;
  width: 100%;
  height: 100%;
  pointer-events: none;
}
.bpmnkit-minimap-shape {
  fill: var(--bpmnkit-shape-stroke, #404040);
  opacity: 0.45;
}
.bpmnkit-minimap-edge {
  stroke: var(--bpmnkit-shape-stroke, #404040);
  stroke-width: 0.5;
  fill: none;
  opacity: 0.35;
}
.bpmnkit-minimap-viewport {
  fill: var(--bpmnkit-viewport-fill, var(--bpmnkit-accent-subtle, rgba(26,86,219,0.12)));
  stroke: var(--bpmnkit-viewport-stroke, var(--bpmnkit-accent, #1a56db));
  stroke-width: 1;
}
`

/**
 * Injects the minimap stylesheet into `<head>` if not already present.
 * Safe to call multiple times — only one `<style>` tag is ever inserted.
 */
export function injectMinimapStyles(): void {
	if (typeof document === "undefined") return
	if (document.getElementById(MINIMAP_STYLE_ID)) return
	const style = document.createElement("style")
	style.id = MINIMAP_STYLE_ID
	style.textContent = MINIMAP_CSS
	document.head.appendChild(style)
}
