export const DMN_EDITOR_CSS = `
.dmn-editor {
  font-family: Arial, sans-serif;
  font-size: 14px;
  overflow: auto;
  height: 100%;
  box-sizing: border-box;
  background: var(--dme-bg, #fff);
  color: var(--dme-fg, #1c1c1c);
}

.dmn-editor-body {
  max-width: 1200px;
  margin: 0 auto;
  padding: 24px;
}

/* ── Light theme (default) ── */
.dmn-editor,
.dmn-editor.light {
  --dme-bg: #fff;
  --dme-fg: #1c1c1c;
  --dme-border: #ddd;
  --dme-hp-bg: #e8f0fe;
  --dme-hp-fg: #1a56db;
  --dme-input-section: #f0f4ff;
  --dme-output-section: #f0fff4;
  --dme-annotation-bg: #fafaf5;
  --dme-row-hover: #f5f5f5;
  --dme-row-even: #fafafa;
  --dme-clause-fg: #888;
  --dme-btn-bg: #e2e8f0;
  --dme-btn-fg: #334155;
  --dme-btn-hover: #cbd5e1;
  --dme-input-cell-bg: transparent;
  --dme-input-cell-fg: #1c1c1c;
  --dme-accent: #3b82f6;
  --dme-divider: 3px double #aaa;
}

/* ── Dark theme ── */
.dmn-editor.dark {
  --dme-bg: #1e1e2e;
  --dme-fg: #cdd6f4;
  --dme-border: #313244;
  --dme-hp-bg: #1e1e3a;
  --dme-hp-fg: #89b4fa;
  --dme-input-section: #1e1e3a;
  --dme-output-section: #1a2e1a;
  --dme-annotation-bg: #252530;
  --dme-row-hover: #2a2a3e;
  --dme-row-even: #252535;
  --dme-clause-fg: #6c6f85;
  --dme-btn-bg: #313244;
  --dme-btn-fg: #bac2de;
  --dme-btn-hover: #45475a;
  --dme-input-cell-bg: transparent;
  --dme-input-cell-fg: #cdd6f4;
  --dme-accent: #89b4fa;
  --dme-divider: 3px double #444;
}

/* ── Decision section ── */
.dme-decision {
  margin-bottom: 32px;
}

.dme-decision-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
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

/* ── Table ── */
.dme-table {
  border-collapse: collapse;
  table-layout: fixed;
  width: 100%;
  min-width: 400px;
}

.dme-table th,
.dme-table td {
  border: 1px solid var(--dme-border);
  padding: 0;
  vertical-align: top;
}

/* ── Hit policy cell ── */
.dme-th-hp {
  position: relative;
  width: 48px;
  min-width: 48px;
  background: var(--dme-hp-bg) !important;
  text-align: center;
  vertical-align: middle !important;
  padding: 0 !important;
}

.dme-hp-abbr {
  display: block;
  font-size: 18px;
  font-weight: 700;
  color: var(--dme-hp-fg);
  pointer-events: none;
  user-select: none;
  line-height: 1;
}

.dme-th-hp .dme-hp-select {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
  cursor: pointer;
  margin: 0;
  padding: 0;
  border: none;
  font-size: 14px;
}

/* ── Column headers ── */
.dme-th-input {
  background: var(--dme-input-section) !important;
  min-width: 160px;
  padding: 6px 8px 4px !important;
}

.dme-th-output {
  background: var(--dme-output-section) !important;
  min-width: 160px;
  padding: 6px 8px 4px !important;
}

.dme-th-annotation {
  background: var(--dme-annotation-bg) !important;
  min-width: 140px;
  padding: 6px 8px 4px !important;
  vertical-align: middle !important;
}

.dme-th-add {
  width: 36px;
  min-width: 36px;
  text-align: center;
  vertical-align: middle !important;
  padding: 4px !important;
  background: var(--dme-bg) !important;
}

/* Double border separating last input from first output */
.dme-th-input.dme-last-input {
  border-right: var(--dme-divider) !important;
}

.dme-table td.dme-last-input {
  border-right: var(--dme-divider) !important;
}

/* ── Clause label (When / And / Then / Annotation) ── */
.dme-clause {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--dme-clause-fg);
  margin-bottom: 4px;
  user-select: none;
}

/* ── Column label / expression inputs ── */
.dme-col-label {
  display: block;
  width: 100%;
  box-sizing: border-box;
  background: transparent;
  border: none;
  border-bottom: 1px solid var(--dme-border);
  color: var(--dme-fg);
  font-size: 12px;
  font-weight: 600;
  padding: 2px 2px;
  outline: none;
  margin-bottom: 2px;
}

.dme-col-expr {
  display: block;
  width: 100%;
  box-sizing: border-box;
  background: transparent;
  border: none;
  border-bottom: 1px dashed var(--dme-border);
  color: var(--dme-clause-fg);
  font-size: 11px;
  padding: 2px 2px;
  outline: none;
  margin-bottom: 4px;
}

.dme-col-label:focus,
.dme-col-expr:focus {
  border-bottom-color: var(--dme-accent);
}

/* ── Column footer: typeRef + delete ── */
.dme-col-footer {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 2px;
}

.dme-typeref {
  flex: 1;
  min-width: 0;
  font-size: 11px;
  background: var(--dme-bg);
  color: var(--dme-fg);
  border: 1px solid var(--dme-border);
  border-radius: 3px;
  padding: 1px 3px;
  outline: none;
  cursor: pointer;
}

/* ── Body rows ── */
.dme-table tr:nth-child(even) td {
  background: var(--dme-row-even);
}

.dme-table tbody tr:hover td {
  background: var(--dme-row-hover);
}

.dme-row-num {
  color: var(--dme-clause-fg);
  font-size: 11px;
  width: 48px;
  min-width: 48px;
  text-align: center;
  user-select: none;
  padding: 6px 4px;
  cursor: context-menu;
  background: var(--dme-hp-bg) !important;
}

.dme-cell-annotation {
  background: var(--dme-annotation-bg) !important;
}

/* ── Entry textarea ── */
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

/* ── Buttons ── */
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

.dme-th-add .dme-btn-icon {
  display: block;
  margin: 2px auto;
}

/* ── Context menu ── */
.dme-ctx-menu {
  position: fixed;
  z-index: 9999;
  background: var(--dme-bg);
  border: 1px solid var(--dme-border);
  border-radius: 4px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  min-width: 160px;
  padding: 3px 0;
  font-size: 13px;
  color: var(--dme-fg);
}

.dme-ctx-item {
  padding: 6px 14px;
  cursor: pointer;
}

.dme-ctx-item:hover {
  background: var(--dme-row-hover);
}

.dme-ctx-sep {
  border: none;
  border-top: 1px solid var(--dme-border);
  margin: 3px 0;
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
