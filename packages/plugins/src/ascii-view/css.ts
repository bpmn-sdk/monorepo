export const ASCII_VIEW_STYLE_ID = "bpmnkit-ascii-view-styles-v1"

export const ASCII_VIEW_CSS = `
.bpmnkit-ascii-overlay {
  position: fixed; inset: 0; z-index: 200;
  background: rgba(0,0,0,0.6);
  display: flex; align-items: center; justify-content: center;
}
.bpmnkit-ascii-panel {
  background: var(--bpmnkit-panel-bg, rgba(13,13,22,0.92));
  border: 1px solid var(--bpmnkit-panel-border, rgba(255,255,255,0.08));
  border-radius: 10px;
  width: 80vw; max-width: 900px; max-height: 80vh;
  display: flex; flex-direction: column;
  font-family: system-ui, sans-serif;
  box-shadow: 0 16px 48px rgba(0,0,0,0.7);
  overflow: hidden;
}
.bpmnkit-ascii-header {
  padding: 14px 18px;
  border-bottom: 1px solid rgba(255,255,255,0.08);
  display: flex; align-items: center; justify-content: space-between;
  flex-shrink: 0;
}
.bpmnkit-ascii-title {
  font-size: 14px; font-weight: 600;
  color: rgba(255,255,255,0.9);
  margin: 0;
}
.bpmnkit-ascii-actions { display: flex; gap: 8px; align-items: center; }
.bpmnkit-ascii-btn {
  font-size: 12px; padding: 4px 12px; border-radius: 5px;
  cursor: pointer; font-weight: 500;
  border: 1px solid rgba(255,255,255,0.12);
  background: rgba(255,255,255,0.06);
  color: rgba(255,255,255,0.8);
}
.bpmnkit-ascii-btn:hover { background: rgba(255,255,255,0.1); }
.bpmnkit-ascii-btn-copied {
  background: rgba(40,180,80,0.25) !important;
  border-color: rgba(40,180,80,0.5) !important;
  color: #8f8 !important;
}
.bpmnkit-ascii-body {
  flex: 1; overflow: auto; padding: 16px 18px;
  background: rgba(0,0,0,0.2);
}
.bpmnkit-ascii-pre {
  margin: 0;
  font-family: "Fira Code", "Cascadia Code", Consolas, Monaco, monospace;
  font-size: 13px; line-height: 1.45;
  color: #b0c4de;
  white-space: pre;
}
/* Light theme */
[data-bpmnkit-hud-theme="light"] .bpmnkit-ascii-panel {
  background: rgba(252,252,254,0.98);
  border-color: var(--bpmnkit-panel-border, rgba(0,0,0,0.08));
  box-shadow: 0 8px 32px rgba(0,0,0,0.15);
}
[data-bpmnkit-hud-theme="light"] .bpmnkit-ascii-header {
  border-bottom-color: var(--bpmnkit-panel-border, rgba(0,0,0,0.08));
}
[data-bpmnkit-hud-theme="light"] .bpmnkit-ascii-title { color: rgba(0,0,0,0.88); }
[data-bpmnkit-hud-theme="light"] .bpmnkit-ascii-btn {
  border-color: rgba(0,0,0,0.12);
  background: rgba(0,0,0,0.04);
  color: rgba(0,0,0,0.7);
}
[data-bpmnkit-hud-theme="light"] .bpmnkit-ascii-btn:hover { background: rgba(0,0,0,0.08); }
[data-bpmnkit-hud-theme="light"] .bpmnkit-ascii-body { background: rgba(0,0,0,0.03); }
[data-bpmnkit-hud-theme="light"] .bpmnkit-ascii-pre { color: #1a3050; }
`

export function injectAsciiViewStyles(): void {
	if (typeof document === "undefined") return
	if (document.getElementById(ASCII_VIEW_STYLE_ID)) return
	const style = document.createElement("style")
	style.id = ASCII_VIEW_STYLE_ID
	style.textContent = ASCII_VIEW_CSS
	document.head.appendChild(style)
}
