/** ID used to prevent duplicate style injection. */
export const EDITOR_STYLE_ID = "bpmn-editor-styles-v1";

/** CSS for editor-specific overlays injected once into `<head>`. */
export const EDITOR_CSS = `
/* Selection outline */
.bpmn-sel-indicator {
  fill: none;
  stroke: #0066cc;
  stroke-width: 1.5;
  pointer-events: none;
}

/* Resize handle */
.bpmn-resize-handle {
  fill: #fff;
  stroke: #0066cc;
  stroke-width: 1.5;
  cursor: nwse-resize;
}
.bpmn-resize-handle[data-bpmn-handle="n"],
.bpmn-resize-handle[data-bpmn-handle="s"] {
  cursor: ns-resize;
}
.bpmn-resize-handle[data-bpmn-handle="e"],
.bpmn-resize-handle[data-bpmn-handle="w"] {
  cursor: ew-resize;
}
.bpmn-resize-handle[data-bpmn-handle="ne"],
.bpmn-resize-handle[data-bpmn-handle="sw"] {
  cursor: nesw-resize;
}
.bpmn-resize-handle[data-bpmn-handle="nw"],
.bpmn-resize-handle[data-bpmn-handle="se"] {
  cursor: nwse-resize;
}

/* Connection port */
.bpmn-conn-port {
  fill: #0066cc;
  stroke: none;
  cursor: crosshair;
  opacity: 0.7;
}
.bpmn-conn-port:hover {
  opacity: 1;
}

/* Rubber-band selection */
.bpmn-rubber-band {
  fill: rgba(0, 102, 204, 0.05);
  stroke: #0066cc;
  stroke-dasharray: 4 2;
  pointer-events: none;
}

/* Ghost element (create / connect preview) */
.bpmn-ghost {
  opacity: 0.45;
  pointer-events: none;
}

/* Ghost connection line */
.bpmn-ghost-conn {
  stroke: #0066cc;
  stroke-width: 1.5;
  stroke-dasharray: 6 3;
  fill: none;
  pointer-events: none;
}

/* Resize preview rect */
.bpmn-resize-preview {
  fill: rgba(0, 102, 204, 0.05);
  stroke: #0066cc;
  stroke-dasharray: 4 2;
  pointer-events: none;
}

/* Alignment guide lines (snap helpers) */
.bpmn-align-guide {
  stroke: #4c8ef7;
  stroke-width: 1;
  stroke-dasharray: 4 2;
  pointer-events: none;
}

/* Edge transparent hit area (wide stroke for easier clicking) */
.bpmn-edge-hitarea {
  fill: none;
  stroke: transparent;
  stroke-width: 12;
  cursor: pointer;
}

/* Edge endpoint drag handles */
.bpmn-edge-endpoint {
  fill: #0066cc;
  stroke: #fff;
  stroke-width: 1.5;
  cursor: grab;
}
.bpmn-edge-endpoint:hover {
  fill: #0052a3;
}

/* Ghost polyline when dragging an edge endpoint */
.bpmn-endpoint-ghost {
  fill: none;
  stroke: #0066cc;
  stroke-width: 1.5;
  stroke-dasharray: 5 3;
  pointer-events: none;
}

/* Edge split target highlight (shown while dragging a shape over an edge) */
.bpmn-edge-split-highlight .bpmn-edge-path {
  stroke: #22c55e;
  stroke-width: 2.5;
}

/* Distance/spacing guide arrows */
.bpmn-dist-guide {
  stroke: #f97316;
  stroke-width: 1;
  fill: none;
  pointer-events: none;
}

/* Space tool split indicator line */
.bpmn-space-line {
  stroke: #f59e0b;
  stroke-width: 1.5;
  stroke-dasharray: 6 3;
  pointer-events: none;
}

/* Label editor */
.bpmn-label-editor {
  position: absolute;
  min-width: 40px;
  min-height: 16px;
  padding: 1px 3px;
  background: #fff;
  border: 1px solid #0066cc;
  border-radius: 2px;
  font-family: system-ui, -apple-system, sans-serif;
  font-size: 11px;
  text-align: center;
  outline: none;
  z-index: 10;
  white-space: pre-wrap;
  word-break: break-word;
}
`;

/** Injects the editor stylesheet into `<head>` if not already present. */
export function injectEditorStyles(): void {
	if (typeof document === "undefined") return;
	if (document.getElementById(EDITOR_STYLE_ID)) return;
	const style = document.createElement("style");
	style.id = EDITOR_STYLE_ID;
	style.textContent = EDITOR_CSS;
	document.head.appendChild(style);
}
