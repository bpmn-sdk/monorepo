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

/* ── Section labels ───────────────────────────────────────────────────────── */
.bpmnkit-palette-section {
  padding: 6px 12px 3px;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.28);
  user-select: none;
}

/* ── Item leading icon (doc / ai) ─────────────────────────────────────────── */
.bpmnkit-palette-item-icon {
  display: flex;
  align-items: center;
  flex-shrink: 0;
  width: 14px;
  height: 14px;
  opacity: 0.55;
}
.bpmnkit-palette-item-icon svg { width: 14px; height: 14px; }

/* ── Doc items ────────────────────────────────────────────────────────────── */
.bpmnkit-palette-item--doc .bpmnkit-palette-item-title {
  color: var(--bpmnkit-accent-bright, #89b4fa);
}
.bpmnkit-palette-item--doc:hover .bpmnkit-palette-item-icon,
.bpmnkit-palette-item--doc.bpmnkit-palette-focused .bpmnkit-palette-item-icon {
  opacity: 0.85;
}

/* ── AI item ──────────────────────────────────────────────────────────────── */
.bpmnkit-palette-item--ai .bpmnkit-palette-item-icon {
  color: var(--bpmnkit-accent, #6b9df7);
  opacity: 0.8;
}
.bpmnkit-palette-item--ai .bpmnkit-palette-item-title {
  color: var(--bpmnkit-accent, #6b9df7);
  font-style: italic;
}
.bpmnkit-palette-item--ai:not(.bpmnkit-palette-item--disabled):hover .bpmnkit-palette-item-icon,
.bpmnkit-palette-item--ai:not(.bpmnkit-palette-item--disabled).bpmnkit-palette-focused .bpmnkit-palette-item-icon {
  opacity: 1;
}

/* ── Disabled items ───────────────────────────────────────────────────────── */
.bpmnkit-palette-item--disabled {
  opacity: 0.45;
  cursor: default;
}
.bpmnkit-palette-item--disabled:hover,
.bpmnkit-palette-item--disabled.bpmnkit-palette-focused {
  background: rgba(255, 255, 255, 0.04);
}

/* ── Light overrides for new additions ───────────────────────────────────── */
.bpmnkit-palette--light .bpmnkit-palette-section { color: rgba(0, 0, 0, 0.3); }
.bpmnkit-palette--light .bpmnkit-palette-item--doc .bpmnkit-palette-item-title {
  color: var(--bpmnkit-accent-bright, #3b82f6);
}
.bpmnkit-palette--light .bpmnkit-palette-item--ai .bpmnkit-palette-item-icon,
.bpmnkit-palette--light .bpmnkit-palette-item--ai .bpmnkit-palette-item-title {
  color: var(--bpmnkit-accent, #1a56db);
}
.bpmnkit-palette--light .bpmnkit-palette-item--disabled:hover,
.bpmnkit-palette--light .bpmnkit-palette-item--disabled.bpmnkit-palette-focused {
  background: rgba(0, 0, 0, 0.03);
}

/* ── Neon theme overrides ─────────────────────────────────────────────────── */
[data-bpmnkit-hud-theme="neon"] .bpmnkit-palette-panel {
  background: oklch(8% 0.03 270 / 0.96);
  border-color: oklch(65% 0.28 280 / 0.2);
  box-shadow: 0 20px 60px oklch(0% 0 0 / 0.7), 0 0 0 1px oklch(65% 0.28 280 / 0.15);
}
[data-bpmnkit-hud-theme="neon"] .bpmnkit-palette-search {
  border-bottom-color: oklch(65% 0.28 280 / 0.15);
}
[data-bpmnkit-hud-theme="neon"] .bpmnkit-palette-search-icon { color: oklch(50% 0.06 280); }
[data-bpmnkit-hud-theme="neon"] .bpmnkit-palette-input { color: oklch(73% 0.16 280); caret-color: oklch(72% 0.18 185); }
[data-bpmnkit-hud-theme="neon"] .bpmnkit-palette-input::placeholder { color: oklch(40% 0.06 280); }
[data-bpmnkit-hud-theme="neon"] .bpmnkit-palette-kbd kbd {
  background: oklch(65% 0.28 280 / 0.08);
  border-color: oklch(65% 0.28 280 / 0.2);
  color: oklch(50% 0.06 280);
}
[data-bpmnkit-hud-theme="neon"] .bpmnkit-palette-empty { color: oklch(40% 0.06 280); }
[data-bpmnkit-hud-theme="neon"] .bpmnkit-palette-section { color: oklch(45% 0.08 280); }
[data-bpmnkit-hud-theme="neon"] .bpmnkit-palette-item { color: oklch(73% 0.16 280); }
[data-bpmnkit-hud-theme="neon"] .bpmnkit-palette-item:hover,
[data-bpmnkit-hud-theme="neon"] .bpmnkit-palette-item.bpmnkit-palette-focused {
  background: oklch(65% 0.28 280 / 0.1);
  color: oklch(85% 0.12 280);
}
[data-bpmnkit-hud-theme="neon"] .bpmnkit-palette-item-desc { color: oklch(45% 0.08 280); }
[data-bpmnkit-hud-theme="neon"] .bpmnkit-palette-item--doc .bpmnkit-palette-item-title {
  color: oklch(72% 0.18 185);
}
[data-bpmnkit-hud-theme="neon"] .bpmnkit-palette-item--ai .bpmnkit-palette-item-icon,
[data-bpmnkit-hud-theme="neon"] .bpmnkit-palette-item--ai .bpmnkit-palette-item-title {
  color: oklch(72% 0.18 185);
}
[data-bpmnkit-hud-theme="neon"] .bpmnkit-palette-item--disabled:hover,
[data-bpmnkit-hud-theme="neon"] .bpmnkit-palette-item--disabled.bpmnkit-palette-focused {
  background: oklch(65% 0.28 280 / 0.04);
}

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
