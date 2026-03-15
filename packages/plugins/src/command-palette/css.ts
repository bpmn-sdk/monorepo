export const COMMAND_PALETTE_STYLE_ID = "bpmnkit-command-palette-styles-v1"

export const COMMAND_PALETTE_CSS = `
/* ── Overlay backdrop ─────────────────────────────────────────────────────── */
.bpmnkit-palette-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(3px);
  z-index: 9999;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 15vh;
  font-family: system-ui, -apple-system, sans-serif;
}

/* ── Panel ────────────────────────────────────────────────────────────────── */
.bpmnkit-palette-panel {
  width: min(560px, calc(100vw - 32px));
  background: var(--bpmnkit-panel-bg, rgba(13,13,22,0.92));
  border: 1px solid var(--bpmnkit-panel-border, rgba(255,255,255,0.08));
  border-radius: 12px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.6);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

/* ── Search row ───────────────────────────────────────────────────────────── */
.bpmnkit-palette-search {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  flex-shrink: 0;
}
.bpmnkit-palette-search-icon {
  display: flex;
  align-items: center;
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  color: rgba(255, 255, 255, 0.35);
  pointer-events: none;
}
.bpmnkit-palette-search-icon svg { width: 16px; height: 16px; }
.bpmnkit-palette-input {
  flex: 1;
  height: 48px;
  background: transparent;
  border: none;
  outline: none;
  color: rgba(255, 255, 255, 0.9);
  font-size: 14px;
  caret-color: var(--bpmnkit-accent, #6b9df7);
}
.bpmnkit-palette-input::placeholder { color: rgba(255, 255, 255, 0.3); }

/* ── Keyboard hint ────────────────────────────────────────────────────────── */
.bpmnkit-palette-kbd {
  display: flex;
  align-items: center;
  gap: 3px;
  flex-shrink: 0;
}
.bpmnkit-palette-kbd kbd {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 2px 5px;
  background: rgba(255, 255, 255, 0.07);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 4px;
  font-family: system-ui, sans-serif;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.4);
  line-height: 1;
}

/* ── Commands list ────────────────────────────────────────────────────────── */
.bpmnkit-palette-list {
  max-height: 360px;
  overflow-y: auto;
  padding: 4px;
}
.bpmnkit-palette-empty {
  padding: 20px 16px;
  text-align: center;
  color: rgba(255, 255, 255, 0.3);
  font-size: 13px;
}
.bpmnkit-palette-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 12px;
  border-radius: 7px;
  cursor: pointer;
  color: rgba(255, 255, 255, 0.75);
  font-size: 13px;
  user-select: none;
}
.bpmnkit-palette-item:hover,
.bpmnkit-palette-item.bpmnkit-palette-focused {
  background: rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.95);
}
.bpmnkit-palette-item-title { flex: 1; }
.bpmnkit-palette-item-desc {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.35);
}

/* ── Light theme overrides ────────────────────────────────────────────────── */
.bpmnkit-palette--light .bpmnkit-palette-panel {
  background: rgba(250, 250, 252, 0.98);
  border-color: var(--bpmnkit-panel-border, rgba(0, 0, 0, 0.08));
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.18);
}
.bpmnkit-palette--light .bpmnkit-palette-search {
  border-bottom-color: var(--bpmnkit-panel-border, rgba(0, 0, 0, 0.08));
}
.bpmnkit-palette--light .bpmnkit-palette-search-icon { color: rgba(0, 0, 0, 0.35); }
.bpmnkit-palette--light .bpmnkit-palette-input { color: rgba(0, 0, 0, 0.9); caret-color: var(--bpmnkit-accent, #1a56db); }
.bpmnkit-palette--light .bpmnkit-palette-input::placeholder { color: rgba(0, 0, 0, 0.3); }
.bpmnkit-palette--light .bpmnkit-palette-kbd kbd {
  background: rgba(0, 0, 0, 0.05);
  border-color: rgba(0, 0, 0, 0.12);
  color: rgba(0, 0, 0, 0.4);
}
.bpmnkit-palette--light .bpmnkit-palette-empty { color: rgba(0, 0, 0, 0.3); }
.bpmnkit-palette--light .bpmnkit-palette-item { color: rgba(0, 0, 0, 0.75); }
.bpmnkit-palette--light .bpmnkit-palette-item:hover,
.bpmnkit-palette--light .bpmnkit-palette-item.bpmnkit-palette-focused {
  background: rgba(0, 0, 0, 0.06);
  color: rgba(0, 0, 0, 0.95);
}
.bpmnkit-palette--light .bpmnkit-palette-item-desc { color: rgba(0, 0, 0, 0.4); }

/* ── Zen mode: hide internal canvas controls ──────────────────────────────── */
.bpmnkit-zen-mode .bpmnkit-zoom-controls,
.bpmnkit-zen-mode .bpmnkit-main-menu-panel {
  display: none !important;
}
`

export function injectCommandPaletteStyles(): void {
	if (typeof document === "undefined") return
	if (document.getElementById(COMMAND_PALETTE_STYLE_ID)) return
	const style = document.createElement("style")
	style.id = COMMAND_PALETTE_STYLE_ID
	style.textContent = COMMAND_PALETTE_CSS
	document.head.appendChild(style)
}
