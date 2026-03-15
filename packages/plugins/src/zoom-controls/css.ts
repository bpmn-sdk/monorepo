export const ZOOM_CONTROLS_STYLE_ID = "bpmnkit-zoom-controls-styles-v1"

export const ZOOM_CONTROLS_CSS = `
.bpmnkit-controls {
  position: absolute;
  bottom: 12px;
  left: 12px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.bpmnkit-control-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  line-height: 1;
  font-size: 16px;
  font-family: system-ui, sans-serif;
  background: var(--bpmnkit-overlay-bg, rgba(248, 249, 250, 0.92));
  border: 1px solid var(--bpmnkit-overlay-border, rgba(0, 0, 0, 0.12));
  border-radius: 4px;
  color: var(--bpmnkit-text, #333333);
  cursor: pointer;
  transition: background 0.1s, color 0.1s;
}
.bpmnkit-control-btn:hover {
  background: var(--bpmnkit-highlight, var(--bpmnkit-accent, #1a56db));
  color: #fff;
  border-color: transparent;
}
.bpmnkit-control-btn:focus {
  outline: 2px solid var(--bpmnkit-focus, var(--bpmnkit-accent, #1a56db));
  outline-offset: 1px;
}
`

export function injectZoomControlsStyles(): void {
	if (typeof document === "undefined") return
	if (document.getElementById(ZOOM_CONTROLS_STYLE_ID)) return
	const style = document.createElement("style")
	style.id = ZOOM_CONTROLS_STYLE_ID
	style.textContent = ZOOM_CONTROLS_CSS
	document.head.appendChild(style)
}
