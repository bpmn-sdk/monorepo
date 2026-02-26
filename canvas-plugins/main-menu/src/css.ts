export const MAIN_MENU_STYLE_ID = "bpmn-main-menu-styles-v1";

export const MAIN_MENU_CSS = `
.bpmn-main-menu-panel {
  position: absolute;
  top: 12px;
  right: 12px;
  display: flex;
  align-items: center;
  gap: 3px;
  padding: 3px;
  background: var(--bpmn-overlay-bg, rgba(248, 249, 250, 0.92));
  border: 1px solid var(--bpmn-overlay-border, rgba(0, 0, 0, 0.12));
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
  z-index: 110;
}
.bpmn-main-menu-title {
  padding: 0 6px;
  font-size: 12px;
  font-weight: 600;
  font-family: system-ui, sans-serif;
  color: var(--bpmn-text, #333333);
  white-space: nowrap;
  user-select: none;
  opacity: 0.75;
}
.bpmn-main-menu-sep {
  width: 1px;
  height: 16px;
  background: var(--bpmn-overlay-border, rgba(0, 0, 0, 0.12));
  flex-shrink: 0;
}
.bpmn-menu-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 4px;
  color: var(--bpmn-text, #333333);
  cursor: pointer;
  padding: 0;
  flex-shrink: 0;
  transition: background 0.1s;
}
.bpmn-menu-btn:hover {
  background: var(--bpmn-overlay-border, rgba(0, 0, 0, 0.08));
}
.bpmn-menu-btn svg {
  width: 16px;
  height: 16px;
  pointer-events: none;
}
.bpmn-menu-dropdown {
  position: fixed;
  display: none;
  flex-direction: column;
  gap: 1px;
  padding: 4px;
  background: var(--bpmn-overlay-bg, rgba(248, 249, 250, 0.96));
  border: 1px solid var(--bpmn-overlay-border, rgba(0, 0, 0, 0.12));
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  z-index: 1000;
  min-width: 150px;
}
.bpmn-menu-dropdown.open { display: flex; }
.bpmn-menu-drop-label {
  padding: 3px 8px 1px;
  font-size: 10px;
  font-weight: 600;
  font-family: system-ui, sans-serif;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--bpmn-text, #333333);
  opacity: 0.45;
}
.bpmn-menu-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  background: transparent;
  border: none;
  border-radius: 5px;
  color: var(--bpmn-text, #333333);
  cursor: pointer;
  font-family: system-ui, sans-serif;
  font-size: 12px;
  text-align: left;
  width: 100%;
  transition: background 0.1s;
}
.bpmn-menu-item:hover {
  background: var(--bpmn-overlay-border, rgba(0, 0, 0, 0.06));
}
.bpmn-menu-item-check {
  width: 12px;
  height: 12px;
  flex-shrink: 0;
  color: var(--bpmn-highlight, #0066cc);
}
.bpmn-menu-item-icon {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
  opacity: 0.65;
}
.bpmn-menu-item-icon svg,
.bpmn-menu-item-check svg {
  width: 100%;
  height: 100%;
}
.bpmn-menu-drop-sep {
  height: 1px;
  background: var(--bpmn-overlay-border, rgba(0,0,0,0.1));
  margin: 3px 4px;
}
`;

export function injectMainMenuStyles(): void {
	if (typeof document === "undefined") return;
	if (document.getElementById(MAIN_MENU_STYLE_ID)) return;
	const style = document.createElement("style");
	style.id = MAIN_MENU_STYLE_ID;
	style.textContent = MAIN_MENU_CSS;
	document.head.appendChild(style);
}
