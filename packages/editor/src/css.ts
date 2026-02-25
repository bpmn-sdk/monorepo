/** ID used to prevent duplicate style injection. */
export const EDITOR_STYLE_ID = "bpmn-editor-styles-v1";

/** ID used to prevent duplicate HUD style injection. */
export const HUD_STYLE_ID = "bpmn-editor-hud-styles-v1";

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

/** CSS for the editor HUD — panels, buttons, dropdowns, group picker. */
export const HUD_CSS = `
/* ── HUD base ────────────────────────────────────────────────────── */
.hud { position: fixed; z-index: 100; }

.panel {
  display: flex; align-items: center; gap: 2px; padding: 4px;
  background: rgba(22, 22, 30, 0.72);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.07);
  border-radius: 10px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}

/* ── HUD positions ───────────────────────────────────────────────── */
#hud-top-center    { top: 10px; left: 50%; transform: translateX(-50%); }
#hud-bottom-left   { bottom: 10px; left: 10px; }
#hud-bottom-center { bottom: 10px; left: 50%; transform: translateX(-50%); }
#ctx-toolbar { display: none; transform: translateX(-50%); }
#cfg-toolbar { display: none; transform: translate(-50%, -100%); }

/* ── Icon buttons ────────────────────────────────────────────────── */
.hud-btn {
  display: flex; align-items: center; justify-content: center;
  width: 32px; height: 32px;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 6px;
  color: rgba(255, 255, 255, 0.4);
  cursor: pointer;
  transition: background 0.15s, color 0.15s, border-color 0.15s;
  padding: 0; flex-shrink: 0;
}
.hud-btn:hover  { background: rgba(255,255,255,0.08); color: rgba(255,255,255,0.9); }
.hud-btn.active { background: rgba(255,255,255,0.12); color: #fff; border-color: rgba(255,255,255,0.18); }
.hud-btn:disabled { opacity: 0.22; cursor: default; }
.hud-btn:disabled:hover { background: transparent; color: rgba(255,255,255,0.4); }
.hud-btn svg { width: 16px; height: 16px; pointer-events: none; }

/* ── Group button: small chevron at bottom-right corner ──────────── */
.hud-btn[data-group] { position: relative; }
.hud-btn[data-group]::after {
  content: '';
  position: absolute; bottom: 3px; right: 3px;
  width: 0; height: 0;
  border-left: 3px solid transparent;
  border-top: 3px solid currentColor;
  opacity: 0.55;
}

/* ── Tool groups container ───────────────────────────────────────── */
#tool-groups { display: flex; align-items: center; gap: 2px; }

/* ── Separator ───────────────────────────────────────────────────── */
.hud-sep { width: 1px; height: 20px; background: rgba(255,255,255,0.07); margin: 0 2px; flex-shrink: 0; }

/* ── Zoom widget ─────────────────────────────────────────────────── */
#btn-zoom-current {
  padding: 0 10px; height: 32px;
  background: transparent; border: 1px solid transparent; border-radius: 7px;
  color: rgba(255,255,255,0.4); cursor: pointer;
  font-size: 12px; font-weight: 600;
  transition: background 0.15s, color 0.15s;
  white-space: nowrap;
}
#btn-zoom-current:hover { background: rgba(255,255,255,0.08); color: rgba(255,255,255,0.9); }

#zoom-expanded { display: none; align-items: center; gap: 2px; }
#zoom-expanded.open { display: flex; }

#btn-zoom-pct {
  padding: 0 8px; height: 30px;
  background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 6px;
  color: rgba(255,255,255,0.6); cursor: pointer;
  font-size: 12px; font-weight: 600;
  transition: background 0.15s, color 0.15s;
  white-space: nowrap; min-width: 60px; text-align: center;
}
#btn-zoom-pct:hover { background: rgba(255,255,255,0.1); color: rgba(255,255,255,0.9); }

/* ── Dropdown menus ──────────────────────────────────────────────── */
.dropdown {
  position: fixed; display: none; flex-direction: column;
  gap: 1px; padding: 4px;
  background: rgba(20, 20, 28, 0.96);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 9px;
  box-shadow: 0 6px 24px rgba(0,0,0,0.5);
  z-index: 200; min-width: 150px;
}
.dropdown.open { display: flex; }

.drop-item {
  display: flex; align-items: center; gap: 8px;
  padding: 7px 10px;
  border: none; background: transparent;
  color: rgba(255,255,255,0.75); cursor: pointer;
  border-radius: 6px; font-size: 12px; text-align: left; width: 100%;
  transition: background 0.1s;
}
.drop-item:hover { background: rgba(255,255,255,0.08); color: #fff; }
.drop-item .di-check { width: 14px; height: 14px; flex-shrink: 0; color: #4c8ef7; }
.drop-item .di-icon  { width: 14px; height: 14px; flex-shrink: 0; opacity: 0.7; }
.drop-item svg { width: 14px; height: 14px; }
.drop-sep { height: 1px; background: rgba(255,255,255,0.08); margin: 3px 0; }
.drop-label {
  padding: 4px 10px 2px;
  font-size: 10px; font-weight: 600; letter-spacing: 0.06em;
  color: rgba(255,255,255,0.3); text-transform: uppercase;
}

/* ── Group element picker ────────────────────────────────────────── */
.group-picker {
  position: fixed;
  display: flex; flex-direction: row;
  gap: 2px; padding: 4px;
  background: rgba(20, 20, 28, 0.96);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 9px;
  box-shadow: 0 6px 24px rgba(0,0,0,0.5);
  z-index: 300;
}
.group-picker-label {
  padding: 2px 6px 4px;
  font-size: 10px; font-weight: 600; letter-spacing: 0.05em;
  color: rgba(255,255,255,0.3); text-transform: uppercase;
  white-space: nowrap; align-self: center;
  border-right: 1px solid rgba(255,255,255,0.08);
  margin-right: 2px;
}
`;

/** Injects the HUD stylesheet into `<head>` if not already present. */
export function injectHudStyles(): void {
	if (typeof document === "undefined") return;
	if (document.getElementById(HUD_STYLE_ID)) return;
	const style = document.createElement("style");
	style.id = HUD_STYLE_ID;
	style.textContent = HUD_CSS;
	document.head.appendChild(style);
}
