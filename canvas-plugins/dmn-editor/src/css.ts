export const DMN_EDITOR_CSS = `
.dmn-editor {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  font-size: 13px;
  overflow: auto;
  height: 100%;
  box-sizing: border-box;
  background: var(--dme-bg, #1e1e2e);
  color: var(--dme-fg, #cdd6f4);
}

.dmn-editor-body {
  max-width: 1100px;
  margin: 0 auto;
  padding: 24px;
}

.dmn-editor.light {
  --dme-bg: #ffffff;
  --dme-fg: #1c1c1c;
  --dme-border: #d0d0d0;
  --dme-header-bg: #f0f4f8;
  --dme-input-bg: #e8f0fe;
  --dme-output-bg: #e8f5e9;
  --dme-row-hover: #f5f5f5;
  --dme-row-even: #fafafa;
  --dme-badge-bg: #e2e8f0;
  --dme-badge-fg: #334155;
  --dme-btn-bg: #e2e8f0;
  --dme-btn-fg: #334155;
  --dme-btn-hover: #cbd5e1;
  --dme-input-cell-bg: transparent;
  --dme-input-cell-fg: #1c1c1c;
  --dme-accent: #3b82f6;
}

.dmn-editor.dark {
  --dme-bg: #1e1e2e;
  --dme-fg: #cdd6f4;
  --dme-border: #313244;
  --dme-header-bg: #181825;
  --dme-input-bg: #1e1e3a;
  --dme-output-bg: #1a2e1a;
  --dme-row-hover: #2a2a3e;
  --dme-row-even: #252535;
  --dme-badge-bg: #313244;
  --dme-badge-fg: #bac2de;
  --dme-btn-bg: #313244;
  --dme-btn-fg: #bac2de;
  --dme-btn-hover: #45475a;
  --dme-input-cell-bg: transparent;
  --dme-input-cell-fg: #cdd6f4;
  --dme-accent: #89b4fa;
}

.dme-decision {
  margin-bottom: 32px;
}

.dme-decision-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.dme-name-input {
  font-size: 15px;
  font-weight: 600;
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  color: var(--dme-fg);
  padding: 2px 4px;
  outline: none;
  min-width: 120px;
}

.dme-name-input:hover,
.dme-name-input:focus {
  border-bottom-color: var(--dme-accent);
}

.dme-hp-select {
  appearance: none;
  background: var(--dme-badge-bg);
  color: var(--dme-badge-fg);
  border: 1px solid var(--dme-border);
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
  padding: 2px 24px 2px 8px;
  cursor: pointer;
  outline: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%23888'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 6px center;
}

.dme-table {
  border-collapse: collapse;
  width: 100%;
  min-width: 400px;
}

.dme-table th,
.dme-table td {
  border: 1px solid var(--dme-border);
  padding: 0;
  vertical-align: top;
}

.dme-table thead th {
  background: var(--dme-header-bg);
  font-weight: 600;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 6px 6px 4px;
}

.dme-th-input {
  background: var(--dme-input-bg) !important;
}

.dme-th-output {
  background: var(--dme-output-bg) !important;
}

.dme-th-inner {
  display: flex;
  align-items: center;
  gap: 4px;
}

.dme-col-label,
.dme-col-expr {
  flex: 1;
  background: transparent;
  border: none;
  border-bottom: 1px solid var(--dme-border);
  color: var(--dme-fg);
  font-size: 11px;
  font-weight: 600;
  padding: 2px 4px;
  outline: none;
  min-width: 40px;
  width: 100%;
}

.dme-col-label:focus,
.dme-col-expr:focus {
  border-bottom-color: var(--dme-accent);
}

.dme-table tr:nth-child(even) td {
  background: var(--dme-row-even);
}

.dme-table tbody tr:hover td {
  background: var(--dme-row-hover);
}

.dme-row-num {
  color: var(--dme-badge-fg);
  font-size: 11px;
  min-width: 24px;
  text-align: center;
  user-select: none;
  padding: 6px 4px;
}

.dme-entry {
  display: block;
  width: 100%;
  box-sizing: border-box;
  background: var(--dme-input-cell-bg);
  border: none;
  color: var(--dme-input-cell-fg);
  font-family: inherit;
  font-size: 13px;
  padding: 6px 8px;
  outline: none;
  resize: none;
  min-height: 32px;
}

.dme-entry:focus {
  background: color-mix(in srgb, var(--dme-accent) 8%, transparent);
  outline: 1px solid var(--dme-accent);
  outline-offset: -1px;
}

.dme-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--dme-btn-bg);
  color: var(--dme-btn-fg);
  border: none;
  border-radius: 3px;
  font-size: 12px;
  padding: 2px 6px;
  cursor: pointer;
  line-height: 1;
  white-space: nowrap;
}

.dme-btn:hover {
  background: var(--dme-btn-hover);
}

.dme-btn-icon {
  width: 20px;
  height: 20px;
  padding: 2px;
  border-radius: 3px;
}

.dme-add-rule {
  margin-top: 8px;
  font-size: 12px;
  padding: 4px 10px;
}

.dme-th-actions {
  width: 28px;
  text-align: center !important;
  padding: 4px !important;
}

.dme-td-actions {
  width: 28px;
  text-align: center;
  vertical-align: middle;
  padding: 4px;
}
`.trim();

const STYLE_ID = "bpmn-sdk-dmn-editor-css";

export function injectDmnEditorStyles(): void {
	if (document.getElementById(STYLE_ID)) return;
	const style = document.createElement("style");
	style.id = STYLE_ID;
	style.textContent = DMN_EDITOR_CSS;
	document.head.appendChild(style);
}
