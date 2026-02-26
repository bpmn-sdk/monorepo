export const STORAGE_CSS = `
.bpmn-st-toggle {
  position: absolute;
  top: 46px;
  left: 8px;
  z-index: 110;
  width: 32px;
  height: 32px;
  border: 1px solid var(--bpmn-border, #dde1e6);
  border-radius: 6px;
  background: var(--bpmn-bg, #f8f9fa);
  color: var(--bpmn-text, #161616);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  box-shadow: 0 1px 3px rgba(0,0,0,.12);
  transition: background 0.15s;
}
.bpmn-st-toggle:hover {
  background: var(--bpmn-hover-bg, #e8ecf0);
}
.bpmn-st-toggle svg {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}

.bpmn-st-panel {
  position: absolute;
  top: 0;
  left: 0;
  bottom: 0;
  width: 260px;
  z-index: 105;
  display: flex;
  flex-direction: column;
  background: var(--bpmn-bg, #f8f9fa);
  border-right: 1px solid var(--bpmn-border, #dde1e6);
  box-shadow: 2px 0 8px rgba(0,0,0,.1);
  font-size: 13px;
  color: var(--bpmn-text, #161616);
  overflow: hidden;
}

.bpmn-st-header {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 8px 10px;
  border-bottom: 1px solid var(--bpmn-border, #dde1e6);
  flex-shrink: 0;
}
.bpmn-st-header-title {
  font-weight: 600;
  font-size: 13px;
  flex: 1;
}
.bpmn-st-header-btn {
  border: 1px solid var(--bpmn-border, #dde1e6);
  border-radius: 4px;
  background: transparent;
  color: var(--bpmn-text, #161616);
  cursor: pointer;
  padding: 2px 8px;
  font-size: 12px;
  line-height: 1.4;
}
.bpmn-st-header-btn:hover {
  background: var(--bpmn-hover-bg, #e8ecf0);
}
.bpmn-st-close-btn {
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--bpmn-text-muted, #697077);
  cursor: pointer;
  padding: 2px 6px;
  font-size: 16px;
  line-height: 1;
  margin-left: 2px;
}
.bpmn-st-close-btn:hover {
  background: var(--bpmn-hover-bg, #e8ecf0);
}

.bpmn-st-tree {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 4px 0;
}

.bpmn-st-row {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  cursor: pointer;
  border-radius: 4px;
  margin: 1px 4px;
  user-select: none;
  min-height: 28px;
}
.bpmn-st-row:hover {
  background: var(--bpmn-hover-bg, #e8ecf0);
}
.bpmn-st-row:hover .bpmn-st-actions {
  opacity: 1;
}

.bpmn-st-ws-row {
  font-weight: 500;
}
.bpmn-st-proj-row {
  padding-left: 16px;
}
.bpmn-st-file-row {
  padding-left: 28px;
}
.bpmn-st-file-row.bpmn-st-active {
  background: var(--bpmn-accent-bg, rgba(0, 98, 255, 0.1));
  color: var(--bpmn-accent, #0062ff);
}

.bpmn-st-chevron {
  width: 12px;
  height: 12px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--bpmn-text-muted, #697077);
  font-size: 10px;
  transition: transform 0.15s;
}
.bpmn-st-chevron.open {
  transform: rotate(90deg);
}

.bpmn-st-icon {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--bpmn-text-muted, #697077);
}
.bpmn-st-icon svg {
  width: 14px;
  height: 14px;
}

.bpmn-st-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.bpmn-st-badge {
  font-size: 10px;
  padding: 1px 4px;
  border-radius: 3px;
  background: var(--bpmn-accent-bg, rgba(0, 98, 255, 0.12));
  color: var(--bpmn-accent, #0062ff);
  flex-shrink: 0;
}

.bpmn-st-actions {
  display: flex;
  gap: 2px;
  opacity: 0;
  transition: opacity 0.1s;
}
.bpmn-st-action-btn {
  border: none;
  border-radius: 3px;
  background: transparent;
  color: var(--bpmn-text-muted, #697077);
  cursor: pointer;
  padding: 2px 4px;
  font-size: 11px;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
}
.bpmn-st-action-btn:hover {
  background: var(--bpmn-border, #dde1e6);
  color: var(--bpmn-text, #161616);
}

.bpmn-st-empty {
  padding: 20px 16px;
  color: var(--bpmn-text-muted, #697077);
  font-size: 12px;
  text-align: center;
  line-height: 1.5;
}

.bpmn-st-type-tag {
  font-size: 10px;
  color: var(--bpmn-text-muted, #697077);
  flex-shrink: 0;
  font-family: monospace;
}

@media (prefers-color-scheme: dark) {
  .bpmn-st-toggle {
    background: var(--bpmn-bg, #262626);
    border-color: var(--bpmn-border, #393939);
    color: var(--bpmn-text, #f4f4f4);
  }
  .bpmn-st-toggle:hover { background: var(--bpmn-hover-bg, #353535); }
  .bpmn-st-panel {
    background: var(--bpmn-bg, #262626);
    border-color: var(--bpmn-border, #393939);
    color: var(--bpmn-text, #f4f4f4);
  }
  .bpmn-st-row:hover { background: var(--bpmn-hover-bg, #353535); }
  .bpmn-st-file-row.bpmn-st-active {
    background: rgba(69, 137, 255, 0.15);
    color: #4589ff;
  }
}
`;

let _injected = false;

export function injectStorageStyles(): void {
	if (_injected) return;
	_injected = true;
	const style = document.createElement("style");
	style.textContent = STORAGE_CSS;
	document.head.appendChild(style);
}
