export const FORM_EDITOR_CSS = `
.form-editor {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  font-size: 13px;
  height: 100%;
  box-sizing: border-box;
  display: flex;
  overflow: hidden;
  background: var(--fe-bg, #1e1e2e);
  color: var(--fe-fg, #cdd6f4);
}

.form-editor.light {
  --fe-bg: #ffffff;
  --fe-fg: #1c1c1c;
  --fe-border: #d0d0d0;
  --fe-panel-bg: #f8f9fa;
  --fe-panel-border: #e5e7eb;
  --fe-row-hover: #f0f4f8;
  --fe-row-selected: #dbeafe;
  --fe-row-selected-fg: #1e40af;
  --fe-badge-bg: #e2e8f0;
  --fe-badge-fg: #334155;
  --fe-btn-bg: #e2e8f0;
  --fe-btn-fg: #334155;
  --fe-btn-hover: #cbd5e1;
  --fe-input-bg: #ffffff;
  --fe-input-border: #d0d0d0;
  --fe-label: #4b5563;
  --fe-accent: #3b82f6;
  --fe-danger: #ef4444;
  --fe-section-fg: #6b7280;
}

.form-editor.dark {
  --fe-bg: #1e1e2e;
  --fe-fg: #cdd6f4;
  --fe-border: #313244;
  --fe-panel-bg: #181825;
  --fe-panel-border: #313244;
  --fe-row-hover: #2a2a3e;
  --fe-row-selected: #1e1e3a;
  --fe-row-selected-fg: #89b4fa;
  --fe-badge-bg: #313244;
  --fe-badge-fg: #bac2de;
  --fe-btn-bg: #313244;
  --fe-btn-fg: #bac2de;
  --fe-btn-hover: #45475a;
  --fe-input-bg: #1e1e2e;
  --fe-input-border: #45475a;
  --fe-label: #bac2de;
  --fe-accent: #89b4fa;
  --fe-danger: #f38ba8;
  --fe-section-fg: #6c7086;
}

/* Two-panel layout */
.fe-list-panel {
  width: 280px;
  flex-shrink: 0;
  border-right: 1px solid var(--fe-border);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--fe-panel-bg);
}

.fe-props-panel {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

/* List panel toolbar */
.fe-toolbar {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 10px;
  border-bottom: 1px solid var(--fe-border);
  flex-shrink: 0;
}

.fe-toolbar-label {
  flex: 1;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--fe-section-fg);
}

.fe-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: var(--fe-btn-bg);
  color: var(--fe-btn-fg);
  border: none;
  border-radius: 3px;
  font-size: 12px;
  padding: 3px 8px;
  cursor: pointer;
  white-space: nowrap;
}

.fe-btn:hover {
  background: var(--fe-btn-hover);
}

.fe-btn-danger {
  color: var(--fe-danger);
}

.fe-btn-icon {
  width: 22px;
  height: 22px;
  padding: 3px;
  border-radius: 3px;
}

/* Component list */
.fe-comp-list {
  flex: 1;
  overflow-y: auto;
  padding: 4px 0;
}

.fe-comp-row {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 5px 10px;
  cursor: pointer;
  border-radius: 3px;
  margin: 1px 4px;
  user-select: none;
}

.fe-comp-row:hover {
  background: var(--fe-row-hover);
}

.fe-comp-row.selected {
  background: var(--fe-row-selected);
  color: var(--fe-row-selected-fg);
}

.fe-comp-type {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  background: var(--fe-badge-bg);
  color: var(--fe-badge-fg);
  padding: 1px 5px;
  border-radius: 3px;
  flex-shrink: 0;
}

.fe-comp-row.selected .fe-comp-type {
  background: color-mix(in srgb, var(--fe-accent) 20%, transparent);
  color: var(--fe-accent);
}

.fe-comp-label {
  flex: 1;
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.fe-comp-actions {
  display: flex;
  gap: 2px;
  opacity: 0;
}

.fe-comp-row:hover .fe-comp-actions,
.fe-comp-row.selected .fe-comp-actions {
  opacity: 1;
}

/* Property panel */
.fe-props-title {
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 14px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--fe-border);
}

.fe-prop-row {
  margin-bottom: 12px;
}

.fe-prop-label {
  display: block;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--fe-label);
  margin-bottom: 4px;
}

.fe-prop-input {
  display: block;
  width: 100%;
  box-sizing: border-box;
  padding: 6px 8px;
  border: 1px solid var(--fe-input-border);
  border-radius: 4px;
  background: var(--fe-input-bg);
  color: var(--fe-fg);
  font-family: inherit;
  font-size: 13px;
  outline: none;
}

.fe-prop-input:focus {
  border-color: var(--fe-accent);
}

.fe-prop-checkbox {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  font-size: 13px;
}

.fe-prop-checkbox input[type="checkbox"] {
  width: 14px;
  height: 14px;
  cursor: pointer;
  accent-color: var(--fe-accent);
}

/* Options list (for select/radio/checklist/taglist) */
.fe-options-list {
  margin-bottom: 6px;
}

.fe-option-row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 4px;
}

.fe-option-row .fe-prop-input {
  flex: 1;
}

.fe-empty-props {
  color: var(--fe-section-fg);
  font-size: 13px;
  text-align: center;
  margin-top: 40px;
}

/* Add-component dropdown */
.fe-add-dropdown {
  position: fixed;
  background: var(--fe-bg);
  border: 1px solid var(--fe-border);
  border-radius: 6px;
  box-shadow: 0 4px 16px rgba(0,0,0,0.25);
  z-index: 999;
  min-width: 180px;
  padding: 4px 0;
  font-size: 12px;
}

.fe-add-dropdown-item {
  display: block;
  padding: 6px 14px;
  cursor: pointer;
  color: var(--fe-fg);
}

.fe-add-dropdown-item:hover {
  background: var(--fe-row-hover);
}

.fe-add-dropdown-sep {
  border: none;
  border-top: 1px solid var(--fe-border);
  margin: 4px 0;
}

.fe-add-dropdown-group {
  padding: 4px 14px 2px;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--fe-section-fg);
}
`.trim();

const STYLE_ID = "bpmn-sdk-form-editor-css";

export function injectFormEditorStyles(): void {
	if (document.getElementById(STYLE_ID)) return;
	const style = document.createElement("style");
	style.id = STYLE_ID;
	style.textContent = FORM_EDITOR_CSS;
	document.head.appendChild(style);
}
