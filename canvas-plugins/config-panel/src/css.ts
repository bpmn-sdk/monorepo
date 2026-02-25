export const CONFIG_PANEL_STYLE_ID = "bpmn-config-panel-styles-v1";

export const CONFIG_PANEL_CSS = `
/* ── Compact panel ───────────────────────────────────────────────────────── */
.bpmn-cfg-compact {
  position: fixed;
  right: 12px;
  top: 12px;
  width: 280px;
  background: rgba(20, 20, 28, 0.95);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 10px;
  box-shadow: 0 4px 24px rgba(0,0,0,0.5);
  z-index: 9999;
  font-family: system-ui, -apple-system, sans-serif;
  font-size: 12px;
  color: rgba(255,255,255,0.85);
  overflow: hidden;
}
.bpmn-cfg-compact-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 12px 8px;
  border-bottom: 1px solid rgba(255,255,255,0.07);
}
.bpmn-cfg-compact-title {
  flex: 1;
  font-size: 11px;
  font-weight: 600;
  color: rgba(255,255,255,0.45);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.bpmn-cfg-compact-body {
  padding: 10px 12px 12px;
  display: flex;
  flex-direction: column;
  gap: 9px;
}
.bpmn-cfg-compact-close {
  width: 20px;
  height: 20px;
  background: none;
  border: none;
  color: rgba(255,255,255,0.35);
  cursor: pointer;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  font-size: 15px;
  line-height: 1;
  flex-shrink: 0;
}
.bpmn-cfg-compact-close:hover { color: #fff; background: rgba(255,255,255,0.08); }

.bpmn-cfg-configure-btn {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 3px;
  padding: 0;
  background: none;
  border: none;
  color: #4c8ef7;
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
  transition: color 0.1s;
  margin-top: 2px;
}
.bpmn-cfg-configure-btn:hover { color: #7aaeff; }

/* ── Full overlay ─────────────────────────────────────────────────────────── */
.bpmn-cfg-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  pointer-events: none;
}
.bpmn-cfg-backdrop {
  position: absolute;
  inset: 0;
  background: rgba(0,0,0,0.35);
  pointer-events: all;
  cursor: pointer;
}
.bpmn-cfg-full {
  position: absolute;
  right: 0;
  top: 0;
  bottom: 0;
  width: 65%;
  min-width: 420px;
  background: rgba(18, 18, 26, 0.98);
  backdrop-filter: blur(16px);
  border-left: 1px solid rgba(255,255,255,0.1);
  box-shadow: -8px 0 40px rgba(0,0,0,0.6);
  display: flex;
  flex-direction: column;
  font-family: system-ui, -apple-system, sans-serif;
  font-size: 13px;
  color: rgba(255,255,255,0.85);
  overflow: hidden;
  pointer-events: all;
}
.bpmn-cfg-full-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 18px 12px;
  border-bottom: 1px solid rgba(255,255,255,0.08);
  flex-shrink: 0;
}
.bpmn-cfg-full-info {
  flex: 1;
  min-width: 0;
}
.bpmn-cfg-full-type {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: rgba(255,255,255,0.35);
  margin-bottom: 2px;
}
.bpmn-cfg-full-name {
  font-size: 15px;
  font-weight: 600;
  color: #fff;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.bpmn-cfg-full-close {
  width: 30px;
  height: 30px;
  background: none;
  border: none;
  color: rgba(255,255,255,0.4);
  cursor: pointer;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  font-size: 20px;
  line-height: 1;
  flex-shrink: 0;
  transition: background 0.1s, color 0.1s;
}
.bpmn-cfg-full-close:hover { background: rgba(255,255,255,0.08); color: #fff; }

/* ── Tabs ─────────────────────────────────────────────────────────────────── */
.bpmn-cfg-tabs {
  display: flex;
  align-items: flex-end;
  gap: 0;
  padding: 0 14px;
  border-bottom: 1px solid rgba(255,255,255,0.08);
  overflow-x: auto;
  flex-shrink: 0;
  scrollbar-width: none;
}
.bpmn-cfg-tabs::-webkit-scrollbar { display: none; }

.bpmn-cfg-tab-btn {
  padding: 10px 14px;
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  color: rgba(255,255,255,0.4);
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;
  transition: color 0.1s, border-color 0.1s;
  margin-bottom: -1px;
}
.bpmn-cfg-tab-btn:hover { color: rgba(255,255,255,0.75); }
.bpmn-cfg-tab-btn.active { color: #4c8ef7; border-bottom-color: #4c8ef7; }

.bpmn-cfg-full-body {
  flex: 1;
  overflow-y: auto;
  padding: 22px 22px 32px;
  scrollbar-width: thin;
  scrollbar-color: rgba(255,255,255,0.15) transparent;
}

/* ── Groups & Fields ──────────────────────────────────────────────────────── */
.bpmn-cfg-group-label {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: rgba(255,255,255,0.3);
  margin-bottom: 14px;
  padding-bottom: 6px;
  border-bottom: 1px solid rgba(255,255,255,0.06);
}
.bpmn-cfg-field {
  margin-bottom: 14px;
}
.bpmn-cfg-field-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 500;
  color: rgba(255,255,255,0.55);
  margin-bottom: 5px;
}
.bpmn-cfg-field-docs {
  font-size: 10px;
  color: #4c8ef7;
  text-decoration: none;
  opacity: 0.7;
  transition: opacity 0.1s;
}
.bpmn-cfg-field-docs:hover { opacity: 1; }

.bpmn-cfg-input,
.bpmn-cfg-select,
.bpmn-cfg-textarea {
  width: 100%;
  padding: 7px 10px;
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 6px;
  color: rgba(255,255,255,0.9);
  font-size: 12px;
  font-family: system-ui, -apple-system, sans-serif;
  outline: none;
  transition: border-color 0.15s, background 0.15s;
  box-sizing: border-box;
}
.bpmn-cfg-input:focus,
.bpmn-cfg-select:focus,
.bpmn-cfg-textarea:focus {
  border-color: #4c8ef7;
  background: rgba(255,255,255,0.09);
}
.bpmn-cfg-select {
  appearance: none;
  cursor: pointer;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M0 0l5 6 5-6' fill='none' stroke='rgba(255,255,255,0.4)' stroke-width='1.5'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 10px center;
  padding-right: 28px;
}
.bpmn-cfg-textarea {
  resize: vertical;
  min-height: 68px;
  line-height: 1.5;
  font-family: ui-monospace, "SF Mono", monospace;
  font-size: 11px;
}
.bpmn-cfg-field-hint {
  font-size: 11px;
  color: rgba(255,255,255,0.3);
  margin-top: 4px;
  line-height: 1.4;
}

/* ── Toggle ───────────────────────────────────────────────────────────────── */
.bpmn-cfg-toggle-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.bpmn-cfg-toggle-label {
  font-size: 12px;
  color: rgba(255,255,255,0.7);
  cursor: pointer;
}
.bpmn-cfg-toggle {
  position: relative;
  display: inline-flex;
  width: 34px;
  height: 18px;
  flex-shrink: 0;
  cursor: pointer;
}
.bpmn-cfg-toggle input {
  opacity: 0;
  width: 0;
  height: 0;
  position: absolute;
}
.bpmn-cfg-toggle-track {
  position: absolute;
  inset: 0;
  background: rgba(255,255,255,0.15);
  border-radius: 9px;
  transition: background 0.2s;
}
.bpmn-cfg-toggle input:checked + .bpmn-cfg-toggle-track { background: #4c8ef7; }
.bpmn-cfg-toggle-thumb {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 14px;
  height: 14px;
  background: #fff;
  border-radius: 50%;
  transition: transform 0.2s;
  pointer-events: none;
}
.bpmn-cfg-toggle input:checked ~ .bpmn-cfg-toggle-thumb { transform: translateX(16px); }

/* ── Light theme overrides ────────────────────────────────────────────────── */
[data-bpmn-hud-theme="light"] .bpmn-cfg-compact {
  background: rgba(255, 255, 255, 0.96);
  border-color: rgba(0,0,0,0.08);
  box-shadow: 0 4px 24px rgba(0,0,0,0.12);
  color: rgba(0,0,0,0.85);
}
[data-bpmn-hud-theme="light"] .bpmn-cfg-compact-header { border-bottom-color: rgba(0,0,0,0.07); }
[data-bpmn-hud-theme="light"] .bpmn-cfg-compact-title { color: rgba(0,0,0,0.4); }
[data-bpmn-hud-theme="light"] .bpmn-cfg-compact-close { color: rgba(0,0,0,0.35); }
[data-bpmn-hud-theme="light"] .bpmn-cfg-compact-close:hover { color: rgba(0,0,0,0.9); background: rgba(0,0,0,0.06); }

[data-bpmn-hud-theme="light"] .bpmn-cfg-backdrop { background: rgba(0,0,0,0.2); }
[data-bpmn-hud-theme="light"] .bpmn-cfg-full {
  background: rgba(248, 248, 252, 0.99);
  border-left-color: rgba(0,0,0,0.08);
  box-shadow: -8px 0 40px rgba(0,0,0,0.12);
  color: rgba(0,0,0,0.85);
}
[data-bpmn-hud-theme="light"] .bpmn-cfg-full-header { border-bottom-color: rgba(0,0,0,0.07); }
[data-bpmn-hud-theme="light"] .bpmn-cfg-full-type { color: rgba(0,0,0,0.35); }
[data-bpmn-hud-theme="light"] .bpmn-cfg-full-name { color: rgba(0,0,0,0.9); }
[data-bpmn-hud-theme="light"] .bpmn-cfg-full-close { color: rgba(0,0,0,0.4); }
[data-bpmn-hud-theme="light"] .bpmn-cfg-full-close:hover { background: rgba(0,0,0,0.06); color: rgba(0,0,0,0.9); }

[data-bpmn-hud-theme="light"] .bpmn-cfg-tabs { border-bottom-color: rgba(0,0,0,0.07); }
[data-bpmn-hud-theme="light"] .bpmn-cfg-tab-btn { color: rgba(0,0,0,0.4); }
[data-bpmn-hud-theme="light"] .bpmn-cfg-tab-btn:hover { color: rgba(0,0,0,0.7); }
[data-bpmn-hud-theme="light"] .bpmn-cfg-full-body { scrollbar-color: rgba(0,0,0,0.15) transparent; }

[data-bpmn-hud-theme="light"] .bpmn-cfg-group-label {
  color: rgba(0,0,0,0.35);
  border-bottom-color: rgba(0,0,0,0.06);
}
[data-bpmn-hud-theme="light"] .bpmn-cfg-field-label { color: rgba(0,0,0,0.55); }
[data-bpmn-hud-theme="light"] .bpmn-cfg-field-hint { color: rgba(0,0,0,0.4); }

[data-bpmn-hud-theme="light"] .bpmn-cfg-input,
[data-bpmn-hud-theme="light"] .bpmn-cfg-select,
[data-bpmn-hud-theme="light"] .bpmn-cfg-textarea {
  background: rgba(0,0,0,0.04);
  border-color: rgba(0,0,0,0.12);
  color: rgba(0,0,0,0.85);
}
[data-bpmn-hud-theme="light"] .bpmn-cfg-input:focus,
[data-bpmn-hud-theme="light"] .bpmn-cfg-select:focus,
[data-bpmn-hud-theme="light"] .bpmn-cfg-textarea:focus {
  background: rgba(0,0,0,0.06);
}
[data-bpmn-hud-theme="light"] .bpmn-cfg-select {
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M0 0l5 6 5-6' fill='none' stroke='rgba(0%2C0%2C0%2C0.45)' stroke-width='1.5'/%3E%3C/svg%3E");
}

[data-bpmn-hud-theme="light"] .bpmn-cfg-toggle-label { color: rgba(0,0,0,0.7); }
[data-bpmn-hud-theme="light"] .bpmn-cfg-toggle-track { background: rgba(0,0,0,0.12); }
`;

export function injectConfigPanelStyles(): void {
	if (typeof document === "undefined") return;
	if (document.getElementById(CONFIG_PANEL_STYLE_ID)) return;
	const style = document.createElement("style");
	style.id = CONFIG_PANEL_STYLE_ID;
	style.textContent = CONFIG_PANEL_CSS;
	document.head.appendChild(style);
}
