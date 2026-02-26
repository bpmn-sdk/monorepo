export const TABS_CSS = `
.bpmn-tabs {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 36px;
  display: flex;
  align-items: stretch;
  background: var(--tabs-bg, #181825);
  border-bottom: 1px solid var(--tabs-border, #313244);
  z-index: 100;
  overflow-x: auto;
  overflow-y: hidden;
  scrollbar-width: none;
  user-select: none;
}

.bpmn-tabs::-webkit-scrollbar {
  display: none;
}

.bpmn-tabs[data-theme="light"] {
  --tabs-bg: #f0f4f8;
  --tabs-border: #d0d0d0;
  --tab-fg: #4b5563;
  --tab-active-bg: #ffffff;
  --tab-active-fg: #1c1c1c;
  --tab-active-border: #3b82f6;
  --tab-hover-bg: #e8edf2;
  --tab-close-hover: rgba(0,0,0,0.08);
  --tab-warn-fg: #d97706;
  --tab-type-bpmn: #3b82f6;
  --tab-type-dmn: #8b5cf6;
  --tab-type-form: #10b981;
}

.bpmn-tabs[data-theme="dark"] {
  --tabs-bg: #181825;
  --tabs-border: #313244;
  --tab-fg: #bac2de;
  --tab-active-bg: #1e1e2e;
  --tab-active-fg: #cdd6f4;
  --tab-active-border: #89b4fa;
  --tab-hover-bg: #252535;
  --tab-close-hover: rgba(255,255,255,0.08);
  --tab-warn-fg: #fab387;
  --tab-type-bpmn: #89b4fa;
  --tab-type-dmn: #cba6f7;
  --tab-type-form: #a6e3a1;
}

.bpmn-tab {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 10px 0 12px;
  min-width: 80px;
  max-width: 200px;
  border-right: 1px solid var(--tabs-border);
  cursor: pointer;
  color: var(--tab-fg);
  font-size: 12px;
  white-space: nowrap;
  position: relative;
  flex-shrink: 0;
  transition: background 0.1s;
}

.bpmn-tab:hover {
  background: var(--tab-hover-bg);
}

.bpmn-tab.active {
  background: var(--tab-active-bg);
  color: var(--tab-active-fg);
  border-bottom: 2px solid var(--tab-active-border);
}

.bpmn-tab-type {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  opacity: 0.7;
}

.bpmn-tab-type.bpmn { color: var(--tab-type-bpmn); }
.bpmn-tab-type.dmn  { color: var(--tab-type-dmn); }
.bpmn-tab-type.form { color: var(--tab-type-form); }

.bpmn-tab-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
}

.bpmn-tab-warn {
  color: var(--tab-warn-fg);
  font-size: 11px;
  font-weight: 600;
  flex-shrink: 0;
}

.bpmn-tab-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  border-radius: 3px;
  font-size: 12px;
  line-height: 1;
  opacity: 0.5;
  flex-shrink: 0;
}

.bpmn-tab-close:hover {
  opacity: 1;
  background: var(--tab-close-hover);
}

/* Content pane — fills remaining space below tabs */
.bpmn-tab-content {
  position: absolute;
  top: 36px;
  left: 0;
  right: 0;
  bottom: 0;
  overflow: hidden;
}

.bpmn-tab-pane {
  position: absolute;
  inset: 0;
  overflow: hidden;
}

.bpmn-tab-pane.hidden {
  display: none;
}
`.trim();

const STYLE_ID = "bpmn-sdk-tabs-css";

export function injectTabsStyles(): void {
	if (document.getElementById(STYLE_ID)) return;
	const style = document.createElement("style");
	style.id = STYLE_ID;
	style.textContent = TABS_CSS;
	document.head.appendChild(style);
}
