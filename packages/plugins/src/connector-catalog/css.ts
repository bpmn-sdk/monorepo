export const CONNECTOR_CATALOG_STYLE_ID = "bpmnkit-connector-catalog-v1"

export const CONNECTOR_CATALOG_CSS = `
/* ── Catalog panel overlay ───────────────────────────────────────────────── */
.bpmnkit-cc-panel-overlay {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.55);
  z-index: 99990;
  animation: bpmnkit-cc-fadein 0.12s ease;
}
.bpmnkit-cc-panel {
  display: flex;
  flex-direction: column;
  width: min(720px, 92vw);
  max-height: 80vh;
  background: var(--bpmnkit-surface, #161626);
  border: 1px solid var(--bpmnkit-border, #2a2a42);
  border-radius: 12px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.6);
  overflow: hidden;
  font-family: var(--bpmnkit-font, system-ui, -apple-system, sans-serif);
  font-size: 13px;
  color: var(--bpmnkit-fg, #cdd6f4);
}
/* Header */
.bpmnkit-cc-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px 12px;
  border-bottom: 1px solid var(--bpmnkit-border, #2a2a42);
  flex-shrink: 0;
}
.bpmnkit-cc-panel__title {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: var(--bpmnkit-fg, #cdd6f4);
}
.bpmnkit-cc-panel__close {
  background: none;
  border: none;
  color: var(--bpmnkit-fg-muted, #8888a8);
  cursor: pointer;
  font-size: 16px;
  line-height: 1;
  padding: 4px 6px;
  border-radius: 4px;
  transition: color 0.1s, background 0.1s;
}
.bpmnkit-cc-panel__close:hover {
  color: var(--bpmnkit-fg, #cdd6f4);
  background: var(--bpmnkit-surface-2, #1e1e2e);
}
/* Search */
.bpmnkit-cc-panel__search {
  padding: 12px 16px 0;
  flex-shrink: 0;
}
.bpmnkit-cc-panel__search-input {
  width: 100%;
  box-sizing: border-box;
  background: var(--bpmnkit-surface-2, #1e1e2e);
  border: 1px solid var(--bpmnkit-border, #2a2a42);
  border-radius: 6px;
  color: var(--bpmnkit-fg, #cdd6f4);
  font-family: inherit;
  font-size: 13px;
  outline: none;
  padding: 7px 10px;
  transition: border-color 0.15s;
}
.bpmnkit-cc-panel__search-input:focus {
  border-color: var(--bpmnkit-accent, #6b9df7);
}
.bpmnkit-cc-panel__search-input::placeholder {
  color: var(--bpmnkit-fg-muted, #8888a8);
}
/* Tabs */
.bpmnkit-cc-panel__tabs {
  display: flex;
  gap: 2px;
  padding: 10px 16px 0;
  border-bottom: 1px solid var(--bpmnkit-border, #2a2a42);
  flex-shrink: 0;
}
.bpmnkit-cc-tab {
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  color: var(--bpmnkit-fg-muted, #8888a8);
  cursor: pointer;
  font-family: inherit;
  font-size: 13px;
  font-weight: 500;
  margin-bottom: -1px;
  padding: 6px 12px 8px;
  transition: color 0.1s, border-color 0.1s;
}
.bpmnkit-cc-tab:hover {
  color: var(--bpmnkit-fg, #cdd6f4);
}
.bpmnkit-cc-tab--active {
  border-bottom-color: var(--bpmnkit-accent, #6b9df7);
  color: var(--bpmnkit-accent, #6b9df7);
}
/* Content */
.bpmnkit-cc-panel__content {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}
/* Built-in card grid */
.bpmnkit-cc-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 10px;
}
.bpmnkit-cc-card {
  display: flex;
  flex-direction: column;
  gap: 6px;
  background: var(--bpmnkit-surface-2, #1e1e2e);
  border: 1px solid var(--bpmnkit-border, #2a2a42);
  border-radius: 8px;
  cursor: pointer;
  padding: 12px;
  transition: border-color 0.15s, background 0.15s;
}
.bpmnkit-cc-card:hover {
  border-color: var(--bpmnkit-accent, #6b9df7);
  background: var(--bpmnkit-accent-subtle, rgba(107,157,247,0.08));
}
.bpmnkit-cc-card__icon {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
}
.bpmnkit-cc-card__icon svg {
  width: 20px;
  height: 20px;
}
.bpmnkit-cc-card__body {
  flex: 1;
}
.bpmnkit-cc-card__name {
  font-weight: 600;
  font-size: 13px;
  color: var(--bpmnkit-fg, #cdd6f4);
  margin-bottom: 3px;
}
.bpmnkit-cc-card__desc {
  font-size: 11px;
  color: var(--bpmnkit-fg-muted, #8888a8);
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.bpmnkit-cc-card__use {
  align-self: flex-start;
  background: var(--bpmnkit-accent, #6b9df7);
  border: none;
  border-radius: 4px;
  color: #fff;
  cursor: pointer;
  font-family: inherit;
  font-size: 11px;
  font-weight: 600;
  padding: 4px 10px;
  transition: opacity 0.1s;
}
.bpmnkit-cc-card__use:hover {
  opacity: 0.85;
}
/* Community row list */
.bpmnkit-cc-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.bpmnkit-cc-row {
  display: flex;
  align-items: center;
  gap: 12px;
  background: var(--bpmnkit-surface-2, #1e1e2e);
  border: 1px solid var(--bpmnkit-border, #2a2a42);
  border-radius: 6px;
  cursor: pointer;
  padding: 10px 12px;
  transition: border-color 0.15s, background 0.15s;
}
.bpmnkit-cc-row:hover {
  border-color: var(--bpmnkit-accent, #6b9df7);
  background: var(--bpmnkit-accent-subtle, rgba(107,157,247,0.08));
}
.bpmnkit-cc-row__body {
  flex: 1;
  min-width: 0;
}
.bpmnkit-cc-row__name {
  font-weight: 600;
  color: var(--bpmnkit-fg, #cdd6f4);
}
.bpmnkit-cc-row__desc {
  font-size: 11px;
  color: var(--bpmnkit-fg-muted, #8888a8);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.bpmnkit-cc-row__import {
  background: none;
  border: 1px solid var(--bpmnkit-border, #2a2a42);
  border-radius: 4px;
  color: var(--bpmnkit-fg-muted, #8888a8);
  cursor: pointer;
  flex-shrink: 0;
  font-family: inherit;
  font-size: 11px;
  padding: 4px 10px;
  transition: border-color 0.1s, color 0.1s;
  white-space: nowrap;
}
.bpmnkit-cc-row__import:hover {
  border-color: var(--bpmnkit-accent, #6b9df7);
  color: var(--bpmnkit-accent, #6b9df7);
}
/* Empty state */
.bpmnkit-cc-empty {
  color: var(--bpmnkit-fg-muted, #8888a8);
  font-size: 13px;
  padding: 32px 0;
  text-align: center;
}
/* Footer */
.bpmnkit-cc-panel__footer {
  border-top: 1px solid var(--bpmnkit-border, #2a2a42);
  display: flex;
  gap: 8px;
  padding: 10px 16px;
  flex-shrink: 0;
}
.bpmnkit-cc-footer-btn {
  background: none;
  border: 1px solid var(--bpmnkit-border, #2a2a42);
  border-radius: 5px;
  color: var(--bpmnkit-fg-muted, #8888a8);
  cursor: pointer;
  font-family: inherit;
  font-size: 12px;
  padding: 5px 12px;
  transition: border-color 0.1s, color 0.1s;
}
.bpmnkit-cc-footer-btn:hover {
  border-color: var(--bpmnkit-accent, #6b9df7);
  color: var(--bpmnkit-accent, #6b9df7);
}
/* Light theme overrides */
[data-bpmnkit-hud-theme="light"] .bpmnkit-cc-panel {
  background: var(--bpmnkit-surface, #ffffff);
  border-color: var(--bpmnkit-border, #d0d0e8);
  color: var(--bpmnkit-fg, #1a1a2e);
}
[data-bpmnkit-hud-theme="light"] .bpmnkit-cc-panel__header,
[data-bpmnkit-hud-theme="light"] .bpmnkit-cc-panel__tabs,
[data-bpmnkit-hud-theme="light"] .bpmnkit-cc-panel__footer {
  border-color: var(--bpmnkit-border, #d0d0e8);
}
[data-bpmnkit-hud-theme="light"] .bpmnkit-cc-panel__title,
[data-bpmnkit-hud-theme="light"] .bpmnkit-cc-card__name,
[data-bpmnkit-hud-theme="light"] .bpmnkit-cc-row__name {
  color: var(--bpmnkit-fg, #1a1a2e);
}
[data-bpmnkit-hud-theme="light"] .bpmnkit-cc-panel__search-input,
[data-bpmnkit-hud-theme="light"] .bpmnkit-cc-card,
[data-bpmnkit-hud-theme="light"] .bpmnkit-cc-row {
  background: var(--bpmnkit-surface-2, #eeeef8);
  border-color: var(--bpmnkit-border, #d0d0e8);
}
/* ── Toast notifications ─────────────────────────────────────────────────── */
.bpmnkit-cc-toast {
  position: fixed;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 9px 16px;
  border-radius: 8px;
  font-family: system-ui, -apple-system, sans-serif;
  font-size: 13px;
  font-weight: 500;
  z-index: 99999;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
  animation: bpmnkit-cc-fadein 0.15s ease;
  max-width: 420px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  pointer-events: none;
}
@keyframes bpmnkit-cc-fadein {
  from { opacity: 0; transform: translateX(-50%) translateY(6px); }
  to   { opacity: 1; transform: translateX(-50%) translateY(0); }
}
.bpmnkit-cc-toast--loading {
  background: var(--bpmnkit-surface-2, #1e1e2e);
  border: 1px solid var(--bpmnkit-border, #2a2a42);
  color: var(--bpmnkit-fg-muted, #8888a8);
}
.bpmnkit-cc-toast--success {
  background: rgba(22, 163, 74, 0.12);
  border: 1px solid rgba(22, 163, 74, 0.35);
  color: var(--bpmnkit-success, #22c55e);
}
.bpmnkit-cc-toast--error {
  background: rgba(220, 38, 38, 0.12);
  border: 1px solid rgba(220, 38, 38, 0.35);
  color: var(--bpmnkit-danger, #f87171);
}
/* Light theme */
[data-bpmnkit-hud-theme="light"] .bpmnkit-cc-toast--loading {
  background: var(--bpmnkit-surface-2, #eeeef8);
  border-color: var(--bpmnkit-border, #d0d0e8);
  color: var(--bpmnkit-fg-muted, #6666a0);
}
[data-bpmnkit-hud-theme="light"] .bpmnkit-cc-toast--success {
  background: rgba(22, 163, 74, 0.07);
  border-color: rgba(22, 163, 74, 0.3);
  color: var(--bpmnkit-success, #16a34a);
}
[data-bpmnkit-hud-theme="light"] .bpmnkit-cc-toast--error {
  background: rgba(220, 38, 38, 0.07);
  border-color: rgba(220, 38, 38, 0.3);
  color: var(--bpmnkit-danger, #dc2626);
}
`

export function injectConnectorCatalogStyles(): void {
	if (typeof document === "undefined") return
	if (document.getElementById(CONNECTOR_CATALOG_STYLE_ID)) return
	const style = document.createElement("style")
	style.id = CONNECTOR_CATALOG_STYLE_ID
	style.textContent = CONNECTOR_CATALOG_CSS
	document.head.appendChild(style)
}
