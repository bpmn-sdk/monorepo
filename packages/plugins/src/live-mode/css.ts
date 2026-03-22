export const STYLE_ID = "bpmnkit-live-mode-v1"

export const CSS = `
/* ── Toggle button ─────────────────────────────────────────────────────────── */
.bpmnkit-live-toggle {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 12px;
  border-radius: 6px;
  border: 1px solid var(--bpmnkit-border, #d0d0e8);
  background: var(--bpmnkit-surface-2, #eeeef8);
  color: var(--bpmnkit-fg, #1a1a2e);
  font-family: var(--bpmnkit-font, system-ui, -apple-system, sans-serif);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s, box-shadow 0.15s;
}
.bpmnkit-live-toggle:hover {
  border-color: var(--bpmnkit-accent, #1a56db);
  color: var(--bpmnkit-accent, #1a56db);
}
.bpmnkit-live-toggle--on {
  border-color: var(--bpmnkit-success, #16a34a);
  color: var(--bpmnkit-success, #16a34a);
  box-shadow: 0 0 0 2px rgba(22, 163, 74, 0.2);
}
.bpmnkit-live-toggle--blocked {
  border-color: var(--bpmnkit-danger, #dc2626);
  color: var(--bpmnkit-danger, #dc2626);
  background: rgba(220, 38, 38, 0.07);
}

/* ── Status pill ───────────────────────────────────────────────────────────── */
.bpmnkit-live-status {
  display: inline-block;
  font-family: var(--bpmnkit-font, system-ui, -apple-system, sans-serif);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  padding: 2px 7px;
  border-radius: 20px;
  background: var(--bpmnkit-surface-2, #eeeef8);
  color: var(--bpmnkit-fg-muted, #6666a0);
  border: 1px solid var(--bpmnkit-border, #d0d0e8);
}
.bpmnkit-live-status--off {
  background: var(--bpmnkit-surface-2, #eeeef8);
  color: var(--bpmnkit-fg-muted, #6666a0);
}
.bpmnkit-live-status--connecting {
  background: rgba(217, 119, 6, 0.12);
  color: var(--bpmnkit-warn, #d97706);
  border-color: var(--bpmnkit-warn, #d97706);
}
.bpmnkit-live-status--live {
  background: rgba(22, 163, 74, 0.12);
  color: var(--bpmnkit-success, #16a34a);
  border-color: var(--bpmnkit-success, #16a34a);
}
.bpmnkit-live-status--error {
  background: rgba(220, 38, 38, 0.12);
  color: var(--bpmnkit-danger, #dc2626);
  border-color: var(--bpmnkit-danger, #dc2626);
}
.bpmnkit-live-status--blocked {
  background: rgba(220, 38, 38, 0.07);
  color: var(--bpmnkit-danger, #dc2626);
  border-color: var(--bpmnkit-danger, #dc2626);
}

/* ── Conflict banner ───────────────────────────────────────────────────────── */
.bpmnkit-live-conflict {
  font-family: var(--bpmnkit-font, system-ui, -apple-system, sans-serif);
  background: rgba(220, 38, 38, 0.07);
  border: 1px solid var(--bpmnkit-danger, #dc2626);
  border-radius: 8px;
  padding: 10px 14px;
  margin: 8px 0;
  font-size: 12px;
  color: var(--bpmnkit-fg, #1a1a2e);
}
.bpmnkit-live-conflict-title {
  font-weight: 700;
  color: var(--bpmnkit-danger, #dc2626);
  margin-bottom: 6px;
}
.bpmnkit-live-conflict-list {
  list-style: disc;
  padding-left: 18px;
  margin-bottom: 8px;
}
.bpmnkit-live-conflict-item {
  font-size: 11px;
  color: var(--bpmnkit-fg-muted, #6666a0);
  font-family: ui-monospace, "Cascadia Code", "JetBrains Mono", monospace;
  margin-bottom: 2px;
}
.bpmnkit-live-btn {
  font-size: 11px;
  padding: 3px 10px;
  border-radius: 5px;
  border: 1px solid var(--bpmnkit-border, #d0d0e8);
  background: var(--bpmnkit-surface, #ffffff);
  color: var(--bpmnkit-fg, #1a1a2e);
  cursor: pointer;
  font-family: var(--bpmnkit-font, system-ui, -apple-system, sans-serif);
  font-weight: 600;
}
.bpmnkit-live-btn:hover {
  background: var(--bpmnkit-accent-subtle, rgba(26,86,219,0.12));
  border-color: var(--bpmnkit-accent, #1a56db);
  color: var(--bpmnkit-accent, #1a56db);
}

/* ── Variable inspector tooltip ────────────────────────────────────────────── */
.bpmnkit-live-vars-tooltip {
  position: fixed;
  z-index: 9999;
  background: var(--bpmnkit-panel-bg, rgba(255,255,255,0.96));
  border: 1px solid var(--bpmnkit-panel-border, rgba(0,0,0,0.1));
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0,0,0,0.14);
  padding: 8px 12px;
  font-family: var(--bpmnkit-font, system-ui, -apple-system, sans-serif);
  font-size: 12px;
  min-width: 160px;
  max-width: 300px;
  pointer-events: none;
}
.bpmnkit-live-vars-row {
  display: flex;
  gap: 8px;
  align-items: baseline;
  padding: 2px 0;
  border-bottom: 1px solid var(--bpmnkit-border, #d0d0e8);
}
.bpmnkit-live-vars-row:last-child {
  border-bottom: none;
}
.bpmnkit-live-vars-name {
  font-weight: 600;
  color: var(--bpmnkit-fg, #1a1a2e);
  flex-shrink: 0;
}
.bpmnkit-live-vars-value {
  color: var(--bpmnkit-fg-muted, #6666a0);
  font-family: ui-monospace, "Cascadia Code", "JetBrains Mono", monospace;
  font-size: 11px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ── Light theme overrides ─────────────────────────────────────────────────── */
[data-bpmnkit-hud-theme="light"] .bpmnkit-live-vars-tooltip {
  background: rgba(255,255,255,0.96);
  border-color: rgba(0,0,0,0.1);
}
`

export function injectLiveModeStyles(): void {
	if (document.getElementById(STYLE_ID) !== null) return
	const style = document.createElement("style")
	style.id = STYLE_ID
	style.textContent = CSS
	document.head.appendChild(style)
}
