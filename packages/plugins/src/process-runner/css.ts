const STYLE_ID = "bpmnkit-process-runner-v1"

const CSS = `
/* ── Toolbar ──────────────────────────────────────────────────────────── */
.bpmnkit-runner-toolbar {
  display: flex;
  gap: 6px;
  align-items: center;
}

/* HUD bottom-center placement (used when toolbar replaces #hud-bottom-center) */
.bpmnkit-runner-toolbar--hud-bottom {
  position: fixed;
  z-index: 100;
  bottom: 10px;
  left: 50%;
  transform: translateX(-50%);
  background: var(--bpmnkit-panel-bg, rgba(13,13,22,0.92));
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 8px;
  backdrop-filter: blur(12px);
  padding: 4px;
  gap: 4px;
}
[data-bpmnkit-hud-theme="light"] .bpmnkit-runner-toolbar--hud-bottom {
  background: rgba(255,255,255,0.96);
  border-color: rgba(0,0,0,0.1);
  box-shadow: 0 2px 16px rgba(0,0,0,0.15);
}
[data-bpmnkit-hud-theme="light"] .bpmnkit-runner-btn--exit {
  background: #e5e7eb;
  color: #374151;
}
[data-bpmnkit-hud-theme="light"] .bpmnkit-runner-btn--exit:hover { background: #d1d5db; }

/* ── Split play button ────────────────────────────────────────────────── */
.bpmnkit-runner-split {
  display: flex;
  border-radius: 6px;
  overflow: visible;
  position: relative;
}

.bpmnkit-runner-chaos-label {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--bpmnkit-fg-muted, rgba(255,255,255,0.55));
  cursor: pointer;
  user-select: none;
  padding: 0 4px;
}
.bpmnkit-runner-chaos-label:has(.bpmnkit-runner-chaos-checkbox:checked) {
  color: var(--bpmnkit-warn, #f59e0b);
}

.bpmnkit-runner-btn {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 6px 12px;
  border: none;
  cursor: pointer;
  font-size: 13px;
  font-family: inherit;
  font-weight: 500;
  background: #2563eb;
  color: #fff;
  white-space: nowrap;
  line-height: 1.4;
  transition: background 0.12s;
}
.bpmnkit-runner-btn:first-child {
  border-radius: 6px 0 0 6px;
}
.bpmnkit-runner-split .bpmnkit-runner-btn:last-child {
  border-radius: 0 6px 6px 0;
  border-left: 1px solid rgba(255,255,255,0.25);
  padding: 6px 9px;
}
.bpmnkit-runner-btn:only-child {
  border-radius: 6px;
}
.bpmnkit-runner-btn:hover:not(:disabled) {
  background: #1d4ed8;
}
.bpmnkit-runner-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Stop */
.bpmnkit-runner-btn--stop {
  background: #dc2626;
  border-radius: 6px;
}
.bpmnkit-runner-btn--stop:hover {
  background: #b91c1c;
}

/* Step (idle: start step mode) */
.bpmnkit-runner-btn--step {
  background: #7c3aed;
  border-radius: 6px;
}
.bpmnkit-runner-btn--step:hover:not(:disabled) {
  background: #6d28d9;
}

/* Step pending (running-step, user can advance) */
.bpmnkit-runner-btn--step-pending {
  background: #d97706;
  border-radius: 6px;
}
.bpmnkit-runner-btn--step-pending:hover {
  background: #b45309;
}

/* Step waiting (running-step, process is mid-execution, not paused yet) */
.bpmnkit-runner-btn--step-waiting {
  background: #6b7280;
  border-radius: 6px;
}

/* Exit play mode */
.bpmnkit-runner-btn--exit {
  background: #374151;
  border-radius: 6px;
}
.bpmnkit-runner-btn--exit:hover {
  background: #4b5563;
}

/* ── Dropdown menu ────────────────────────────────────────────────────── */
.bpmnkit-runner-dropdown {
  position: fixed;
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  box-shadow: 0 4px 16px rgba(0,0,0,0.15);
  min-width: 190px;
  z-index: 20;
  overflow: hidden;
}
.bpmnkit-runner-dropdown[data-theme="dark"] {
  background: #1f2937;
  border-color: #374151;
  color: #f9fafb;
}

.bpmnkit-runner-dropdown-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 9px 14px;
  border: none;
  background: none;
  text-align: left;
  cursor: pointer;
  font-size: 13px;
  font-family: inherit;
  color: inherit;
  box-sizing: border-box;
}
.bpmnkit-runner-dropdown-item:hover {
  background: #f3f4f6;
}
.bpmnkit-runner-dropdown[data-theme="dark"] .bpmnkit-runner-dropdown-item:hover {
  background: #374151;
}

/* ── Payload modal ────────────────────────────────────────────────────── */
.bpmnkit-runner-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.45);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
}

.bpmnkit-runner-modal {
  background: #ffffff;
  border-radius: 10px;
  padding: 24px;
  width: 480px;
  max-width: 90vw;
  box-shadow: 0 20px 60px rgba(0,0,0,0.3);
  font-family: inherit;
}
.bpmnkit-runner-modal[data-theme="dark"] {
  background: #1f2937;
  color: #f9fafb;
}

.bpmnkit-runner-modal-title {
  font-size: 15px;
  font-weight: 600;
  margin: 0 0 14px;
}

.bpmnkit-runner-modal-textarea {
  width: 100%;
  box-sizing: border-box;
  height: 180px;
  font-family: ui-monospace, "SFMono-Regular", "Menlo", monospace;
  font-size: 13px;
  padding: 10px 12px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  resize: vertical;
  background: #f9fafb;
  color: inherit;
}
.bpmnkit-runner-modal[data-theme="dark"] .bpmnkit-runner-modal-textarea {
  background: #111827;
  border-color: #374151;
  color: #f9fafb;
}

.bpmnkit-runner-modal-error {
  color: var(--bpmnkit-danger, #dc2626);
  font-size: 12px;
  margin-top: 6px;
  min-height: 18px;
}

.bpmnkit-runner-modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 18px;
}

.bpmnkit-runner-modal-btn {
  padding: 7px 18px;
  border-radius: 6px;
  border: none;
  cursor: pointer;
  font-size: 13px;
  font-family: inherit;
  font-weight: 500;
}
.bpmnkit-runner-modal-btn--cancel {
  background: #f3f4f6;
  color: #374151;
}
.bpmnkit-runner-modal-btn--cancel:hover {
  background: #e5e7eb;
}
.bpmnkit-runner-modal[data-theme="dark"] .bpmnkit-runner-modal-btn--cancel {
  background: #374151;
  color: #f9fafb;
}
.bpmnkit-runner-modal-btn--run {
  background: #2563eb;
  color: #fff;
}
.bpmnkit-runner-modal-btn--run:hover {
  background: #1d4ed8;
}

/* ── Play panel (mounted inside dock.playPane) ────────────────────────── */
.bpmnkit-runner-play-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  color: rgba(255,255,255,0.75);
  font-size: 12px;
  font-family: system-ui, -apple-system, sans-serif;
}

.bpmnkit-runner-play-tabs {
  display: flex;
  border-bottom: 1px solid rgba(255,255,255,0.08);
  flex-shrink: 0;
}

.bpmnkit-runner-play-tab {
  padding: 8px 16px;
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  color: rgba(255,255,255,0.4);
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
  font-family: inherit;
  white-space: nowrap;
  transition: color 0.1s, border-color 0.1s;
}
.bpmnkit-runner-play-tab:hover { color: rgba(255,255,255,0.75); }
.bpmnkit-runner-play-tab--active { color: var(--bpmnkit-accent, #6b9df7); border-bottom-color: var(--bpmnkit-accent, #6b9df7); }

.bpmnkit-runner-play-pane {
  flex: 1;
  overflow-y: auto;
  padding: 10px 14px;
  min-height: 0;
}
.bpmnkit-runner-play-pane--hidden { display: none !important; }

/* ── Timeline scrubber ───────────────────────────────────────────────────── */
.bpmnkit-runner-scrubber-row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border-bottom: 1px solid rgba(255,255,255,0.06);
  font-size: 11px;
}
.bpmnkit-runner-scrubber {
  flex: 1;
  height: 4px;
  accent-color: var(--bpmnkit-accent, #6b9df7);
  cursor: pointer;
}
.bpmnkit-runner-scrubber-index {
  color: rgba(255,255,255,0.4);
  white-space: nowrap;
  min-width: 100px;
  text-align: right;
}
.bpmnkit-runner-scrubber-live,
.bpmnkit-runner-scrubber-replay {
  background: none;
  border: 1px solid rgba(255,255,255,0.2);
  border-radius: 4px;
  color: rgba(255,255,255,0.7);
  font-size: 10px;
  padding: 2px 6px;
  cursor: pointer;
  white-space: nowrap;
}
.bpmnkit-runner-scrubber-live:hover,
.bpmnkit-runner-scrubber-replay:hover { border-color: var(--bpmnkit-accent, #6b9df7); color: var(--bpmnkit-accent, #6b9df7); }
[data-bpmnkit-hud-theme="light"] .bpmnkit-runner-scrubber-row { border-color: rgba(0,0,0,0.08); }
[data-bpmnkit-hud-theme="light"] .bpmnkit-runner-scrubber-index { color: rgba(0,0,0,0.4); }
[data-bpmnkit-hud-theme="light"] .bpmnkit-runner-scrubber-live,
[data-bpmnkit-hud-theme="light"] .bpmnkit-runner-scrubber-replay { border-color: rgba(0,0,0,0.2); color: rgba(0,0,0,0.6); }

.bpmnkit-runner-play-empty {
  color: rgba(255,255,255,0.25);
  text-align: center;
  padding: 20px 0;
}

/* Variables */
.bpmnkit-runner-play-var-row {
  display: flex;
  align-items: baseline;
  gap: 8px;
  padding: 5px 0;
  border-bottom: 1px solid rgba(255,255,255,0.05);
}
.bpmnkit-runner-play-var-name { color: rgba(255,255,255,0.55); flex-shrink: 0; }
.bpmnkit-runner-play-var-name::after { content: ":"; margin-left: 1px; }
.bpmnkit-runner-play-var-value {
  color: #a5f3fc;
  font-family: ui-monospace, "SFMono-Regular", "Menlo", monospace;
  font-size: 11px;
  word-break: break-all;
}

/* FEEL evaluations */
.bpmnkit-runner-play-feel-group { margin-bottom: 14px; }
.bpmnkit-runner-play-feel-header {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: rgba(255,255,255,0.3);
  padding: 3px 0;
  border-bottom: 1px solid rgba(255,255,255,0.07);
  margin-bottom: 6px;
}
.bpmnkit-runner-play-feel-row {
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 6px 0;
  border-bottom: 1px solid rgba(255,255,255,0.04);
}
.bpmnkit-runner-play-feel-prop { color: rgba(255,255,255,0.4); font-size: 11px; }
.bpmnkit-runner-play-feel-expr {
  font-family: ui-monospace, "SFMono-Regular", "Menlo", monospace;
  font-size: 11px;
  color: #fde68a;
  background: rgba(255,255,255,0.06);
  padding: 2px 5px;
  border-radius: 3px;
  display: block;
}
.bpmnkit-runner-play-feel-result-row { display: flex; align-items: center; gap: 5px; }
.bpmnkit-runner-play-feel-arrow { color: rgba(255,255,255,0.3); }
.bpmnkit-runner-play-feel-result {
  color: #a5f3fc;
  font-family: ui-monospace, "SFMono-Regular", "Menlo", monospace;
  font-size: 11px;
}

/* ── Errors tab ──────────────────────────────────────────────────────────── */
.bpmnkit-runner-play-error-row {
  padding: 8px 0;
  border-bottom: 1px solid rgba(255,255,255,0.05);
}
.bpmnkit-runner-play-error-id {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: rgba(248,113,113,0.7);
  margin-bottom: 2px;
}
.bpmnkit-runner-play-error-msg {
  font-size: 12px;
  color: var(--bpmnkit-danger, #f87171);
}

/* ── Input variables tab ──────────────────────────────────────────────────── */
.bpmnkit-runner-play-ivar-row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 0;
  border-bottom: 1px solid rgba(255,255,255,0.05);
}
.bpmnkit-runner-play-ivar-name,
.bpmnkit-runner-play-ivar-value {
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: 4px;
  color: inherit;
  font-size: 12px;
  font-family: inherit;
  padding: 4px 7px;
}
.bpmnkit-runner-play-ivar-name { width: 90px; flex-shrink: 0; }
.bpmnkit-runner-play-ivar-value { flex: 1; min-width: 0; }
.bpmnkit-runner-play-ivar-name:focus,
.bpmnkit-runner-play-ivar-value:focus { outline: none; border-color: var(--bpmnkit-accent, #6b9df7); }
.bpmnkit-runner-play-ivar-eq { color: rgba(255,255,255,0.3); font-size: 12px; flex-shrink: 0; }
.bpmnkit-runner-play-ivar-del {
  background: none;
  border: none;
  color: rgba(255,255,255,0.3);
  cursor: pointer;
  font-size: 14px;
  padding: 0 4px;
  flex-shrink: 0;
  line-height: 1;
}
.bpmnkit-runner-play-ivar-del:hover { color: var(--bpmnkit-danger, #f87171); }
.bpmnkit-runner-play-ivar-add {
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: 1px dashed rgba(255,255,255,0.2);
  border-radius: 4px;
  color: rgba(255,255,255,0.4);
  cursor: pointer;
  font-size: 12px;
  font-family: inherit;
  padding: 6px 10px;
  width: 100%;
  margin-top: 8px;
  box-sizing: border-box;
}
.bpmnkit-runner-play-ivar-add:hover { border-color: var(--bpmnkit-accent, #6b9df7); color: var(--bpmnkit-accent, #6b9df7); }

/* ── Input variable hints (from validation DMN) ──────────────────────────── */
.bpmnkit-runner-play-ivar-hints {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
  padding: 6px 10px;
  background: rgba(107,157,247,0.06);
  border-bottom: 1px solid rgba(107,157,247,0.12);
  font-size: 11px;
}
.bpmnkit-runner-play-ivar-hints-label {
  color: var(--bpmnkit-fg-muted, #8888a8);
  flex-shrink: 0;
}
.bpmnkit-runner-play-ivar-hint-chip {
  background: rgba(107,157,247,0.12);
  color: var(--bpmnkit-accent-bright, #89b4fa);
  border-radius: 3px;
  padding: 1px 5px;
  font-family: var(--bpmnkit-font-mono, monospace);
}
[data-bpmnkit-hud-theme="light"] .bpmnkit-runner-play-ivar-hints {
  background: rgba(26,86,219,0.05);
  border-bottom-color: rgba(26,86,219,0.1);
}
[data-bpmnkit-hud-theme="light"] .bpmnkit-runner-play-ivar-hints-label { color: rgba(0,0,0,0.4); }
[data-bpmnkit-hud-theme="light"] .bpmnkit-runner-play-ivar-hint-chip {
  background: rgba(26,86,219,0.08);
  color: var(--bpmnkit-accent, #1a56db);
}

/* ── Light theme overrides ───────────────────────────────────────────────── */
[data-bpmnkit-hud-theme="light"] .bpmnkit-runner-play-panel { color: rgba(0,0,0,0.75); }
[data-bpmnkit-hud-theme="light"] .bpmnkit-runner-play-tabs { border-bottom-color: rgba(0,0,0,0.07); }
[data-bpmnkit-hud-theme="light"] .bpmnkit-runner-play-tab { color: rgba(0,0,0,0.4); }
[data-bpmnkit-hud-theme="light"] .bpmnkit-runner-play-tab:hover { color: rgba(0,0,0,0.7); }
[data-bpmnkit-hud-theme="light"] .bpmnkit-runner-play-tab--active { color: var(--bpmnkit-accent, #1a56db); border-bottom-color: var(--bpmnkit-accent, #1a56db); }
[data-bpmnkit-hud-theme="light"] .bpmnkit-runner-play-empty { color: rgba(0,0,0,0.3); }
[data-bpmnkit-hud-theme="light"] .bpmnkit-runner-play-var-name { color: rgba(0,0,0,0.6); }
[data-bpmnkit-hud-theme="light"] .bpmnkit-runner-play-var-value { color: #0369a1; }
[data-bpmnkit-hud-theme="light"] .bpmnkit-runner-play-var-row { border-bottom-color: rgba(0,0,0,0.06); }
[data-bpmnkit-hud-theme="light"] .bpmnkit-runner-play-feel-header { color: rgba(0,0,0,0.35); border-bottom-color: rgba(0,0,0,0.08); }
[data-bpmnkit-hud-theme="light"] .bpmnkit-runner-play-feel-prop { color: rgba(0,0,0,0.45); }
[data-bpmnkit-hud-theme="light"] .bpmnkit-runner-play-feel-expr { color: #92400e; background: rgba(0,0,0,0.04); }
[data-bpmnkit-hud-theme="light"] .bpmnkit-runner-play-feel-arrow { color: rgba(0,0,0,0.3); }
[data-bpmnkit-hud-theme="light"] .bpmnkit-runner-play-feel-result { color: #0369a1; }
[data-bpmnkit-hud-theme="light"] .bpmnkit-runner-play-feel-row { border-bottom-color: rgba(0,0,0,0.05); }
[data-bpmnkit-hud-theme="light"] .bpmnkit-runner-play-error-row { border-bottom-color: rgba(0,0,0,0.06); }
[data-bpmnkit-hud-theme="light"] .bpmnkit-runner-play-error-id { color: rgba(220,38,38,0.7); }
[data-bpmnkit-hud-theme="light"] .bpmnkit-runner-play-error-msg { color: var(--bpmnkit-danger, #dc2626); }
[data-bpmnkit-hud-theme="light"] .bpmnkit-runner-play-ivar-row { border-bottom-color: rgba(0,0,0,0.06); }
[data-bpmnkit-hud-theme="light"] .bpmnkit-runner-play-ivar-name,
[data-bpmnkit-hud-theme="light"] .bpmnkit-runner-play-ivar-value {
  background: rgba(0,0,0,0.04);
  border-color: rgba(0,0,0,0.12);
  color: rgba(0,0,0,0.75);
}
[data-bpmnkit-hud-theme="light"] .bpmnkit-runner-play-ivar-eq { color: rgba(0,0,0,0.3); }
[data-bpmnkit-hud-theme="light"] .bpmnkit-runner-play-ivar-del { color: rgba(0,0,0,0.3); }
[data-bpmnkit-hud-theme="light"] .bpmnkit-runner-play-ivar-del:hover { color: var(--bpmnkit-danger, #dc2626); }
[data-bpmnkit-hud-theme="light"] .bpmnkit-runner-play-ivar-add {
  border-color: rgba(0,0,0,0.2);
  color: rgba(0,0,0,0.4);
}
[data-bpmnkit-hud-theme="light"] .bpmnkit-runner-play-ivar-add:hover { border-color: var(--bpmnkit-accent, #1a56db); color: var(--bpmnkit-accent, #1a56db); }

/* ── Tests tab ───────────────────────────────────────────────────────────── */
.bpmnkit-runner-tests-header {
  display: flex;
  gap: 6px;
  align-items: center;
  padding-bottom: 8px;
  border-bottom: 1px solid rgba(255,255,255,0.06);
  margin-bottom: 8px;
}
.bpmnkit-runner-tests-run-all, .bpmnkit-runner-tests-add { font-size: 11px; padding: 3px 8px; }
.bpmnkit-runner-tests-row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 0;
  border-bottom: 1px solid rgba(255,255,255,0.04);
}
.bpmnkit-runner-tests-pass .bpmnkit-runner-tests-status { color: var(--bpmnkit-success, #22c55e); }
.bpmnkit-runner-tests-fail .bpmnkit-runner-tests-status { color: var(--bpmnkit-danger, #f87171); }
.bpmnkit-runner-tests-status { font-size: 14px; width: 16px; text-align: center; }
.bpmnkit-runner-tests-name {
  flex: 1;
  background: none;
  border: none;
  border-bottom: 1px solid rgba(255,255,255,0.1);
  color: inherit;
  font-size: 12px;
  padding: 2px 4px;
}
.bpmnkit-runner-tests-name:focus { outline: none; border-color: var(--bpmnkit-accent, #6b9df7); }
.bpmnkit-runner-tests-run-one, .bpmnkit-runner-tests-del {
  background: none;
  border: none;
  color: rgba(255,255,255,0.4);
  cursor: pointer;
  padding: 2px 4px;
  font-size: 12px;
}
.bpmnkit-runner-tests-run-one:hover { color: var(--bpmnkit-accent, #6b9df7); }
.bpmnkit-runner-tests-del:hover { color: var(--bpmnkit-danger, #f87171); }
.bpmnkit-runner-tests-diff {
  padding: 4px 0 4px 22px;
  font-size: 11px;
  color: rgba(255,255,255,0.5);
}
.bpmnkit-runner-tests-diff-row { padding: 1px 0; }
.bpmnkit-runner-tests-diff-error { color: var(--bpmnkit-danger, #f87171); }
[data-bpmnkit-hud-theme="light"] .bpmnkit-runner-tests-header { border-color: rgba(0,0,0,0.08); }
[data-bpmnkit-hud-theme="light"] .bpmnkit-runner-tests-row { border-color: rgba(0,0,0,0.04); }
[data-bpmnkit-hud-theme="light"] .bpmnkit-runner-tests-name { border-color: rgba(0,0,0,0.15); }
[data-bpmnkit-hud-theme="light"] .bpmnkit-runner-tests-run-one,
[data-bpmnkit-hud-theme="light"] .bpmnkit-runner-tests-del { color: rgba(0,0,0,0.3); }
[data-bpmnkit-hud-theme="light"] .bpmnkit-runner-tests-diff { color: rgba(0,0,0,0.4); }

/* ── Tests tab extra buttons ─────────────────────────────────────────────── */
.bpmnkit-runner-tests-gen, .bpmnkit-runner-tests-chaos-import { font-size: 11px; padding: 3px 8px; }
.bpmnkit-runner-tests-chaos-import {
  color: var(--bpmnkit-warn, #f59e0b);
  border-color: var(--bpmnkit-warn, #f59e0b);
}
.bpmnkit-runner-tests-chaos-import:hover {
  background: rgba(245,158,11,0.12);
}

/* ── Scenario editor ─────────────────────────────────────────────────────── */
.bpmnkit-runner-tests-editor-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding-bottom: 8px;
  border-bottom: 1px solid rgba(255,255,255,0.06);
  margin-bottom: 10px;
  flex-wrap: wrap;
}
.bpmnkit-runner-tests-back {
  font-size: 11px;
  padding: 3px 8px;
  flex-shrink: 0;
}
.bpmnkit-runner-tests-editor-name {
  flex: 1;
  min-width: 80px;
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: 4px;
  color: inherit;
  font-size: 12px;
  font-family: inherit;
  padding: 4px 7px;
}
.bpmnkit-runner-tests-editor-name:focus { outline: none; border-color: var(--bpmnkit-accent, #6b9df7); }
.bpmnkit-runner-tests-editor-badge {
  font-size: 11px;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: 4px;
  flex-shrink: 0;
}
.bpmnkit-runner-tests-editor-badge--pass { color: var(--bpmnkit-success, #22c55e); background: rgba(34,197,94,0.12); }
.bpmnkit-runner-tests-editor-badge--fail { color: var(--bpmnkit-danger, #f87171); background: rgba(248,113,113,0.12); }

.bpmnkit-runner-tests-section-title {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: rgba(255,255,255,0.3);
  padding: 10px 0 4px;
  border-bottom: 1px solid rgba(255,255,255,0.06);
  margin-bottom: 6px;
}
.bpmnkit-runner-tests-varlist { margin-bottom: 4px; }

.bpmnkit-runner-tests-hint {
  font-size: 11px;
  color: rgba(255,255,255,0.25);
  margin-bottom: 6px;
  font-style: italic;
}

.bpmnkit-runner-tests-task {
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 6px;
  margin-bottom: 6px;
  overflow: hidden;
}
.bpmnkit-runner-tests-task--focused {
  border-color: var(--bpmnkit-accent, #6b9df7);
}
.bpmnkit-runner-tests-task-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  cursor: pointer;
  user-select: none;
  background: rgba(255,255,255,0.03);
}
.bpmnkit-runner-tests-task-header:hover { background: rgba(255,255,255,0.06); }
.bpmnkit-runner-tests-task--focused .bpmnkit-runner-tests-task-header {
  background: rgba(107,157,247,0.08);
}
.bpmnkit-runner-tests-task-name {
  flex: 1;
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.bpmnkit-runner-tests-task-badge {
  font-size: 10px;
  color: rgba(255,255,255,0.35);
  background: rgba(255,255,255,0.06);
  border-radius: 3px;
  padding: 1px 5px;
  flex-shrink: 0;
}
.bpmnkit-runner-tests-task-body {
  padding: 8px 10px;
  border-top: 1px solid rgba(255,255,255,0.06);
}
.bpmnkit-runner-tests-error-row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 8px;
}
.bpmnkit-runner-tests-error-label {
  font-size: 11px;
  color: rgba(255,255,255,0.4);
  flex-shrink: 0;
}
.bpmnkit-runner-tests-error-input {
  flex: 1;
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: 4px;
  color: inherit;
  font-size: 11px;
  font-family: inherit;
  padding: 3px 6px;
}
.bpmnkit-runner-tests-error-input:focus { outline: none; border-color: var(--bpmnkit-danger, #f87171); }

.bpmnkit-runner-tests-name-label {
  flex: 1;
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.bpmnkit-runner-tests-edit {
  background: none;
  border: none;
  color: rgba(255,255,255,0.4);
  cursor: pointer;
  padding: 2px 4px;
  font-size: 13px;
}
.bpmnkit-runner-tests-edit:hover { color: var(--bpmnkit-accent, #6b9df7); }

/* ── Light overrides (editor) ──────────────────────────────────────────────── */
[data-bpmnkit-hud-theme="light"] .bpmnkit-runner-tests-editor-header { border-color: rgba(0,0,0,0.08); }
[data-bpmnkit-hud-theme="light"] .bpmnkit-runner-tests-editor-name {
  background: rgba(0,0,0,0.04);
  border-color: rgba(0,0,0,0.12);
  color: rgba(0,0,0,0.75);
}
[data-bpmnkit-hud-theme="light"] .bpmnkit-runner-tests-section-title { color: rgba(0,0,0,0.35); border-color: rgba(0,0,0,0.08); }
[data-bpmnkit-hud-theme="light"] .bpmnkit-runner-tests-hint { color: rgba(0,0,0,0.3); }
[data-bpmnkit-hud-theme="light"] .bpmnkit-runner-tests-task { border-color: rgba(0,0,0,0.1); }
[data-bpmnkit-hud-theme="light"] .bpmnkit-runner-tests-task--focused { border-color: var(--bpmnkit-accent, #1a56db); }
[data-bpmnkit-hud-theme="light"] .bpmnkit-runner-tests-task-header { background: rgba(0,0,0,0.02); }
[data-bpmnkit-hud-theme="light"] .bpmnkit-runner-tests-task-header:hover { background: rgba(0,0,0,0.05); }
[data-bpmnkit-hud-theme="light"] .bpmnkit-runner-tests-task--focused .bpmnkit-runner-tests-task-header { background: rgba(26,86,219,0.06); }
[data-bpmnkit-hud-theme="light"] .bpmnkit-runner-tests-task-badge { color: rgba(0,0,0,0.4); background: rgba(0,0,0,0.06); }
[data-bpmnkit-hud-theme="light"] .bpmnkit-runner-tests-task-body { border-color: rgba(0,0,0,0.08); }
[data-bpmnkit-hud-theme="light"] .bpmnkit-runner-tests-error-label { color: rgba(0,0,0,0.45); }
[data-bpmnkit-hud-theme="light"] .bpmnkit-runner-tests-error-input {
  background: rgba(0,0,0,0.04);
  border-color: rgba(0,0,0,0.12);
  color: rgba(0,0,0,0.75);
}
[data-bpmnkit-hud-theme="light"] .bpmnkit-runner-tests-name-label { color: rgba(0,0,0,0.75); }
[data-bpmnkit-hud-theme="light"] .bpmnkit-runner-tests-edit { color: rgba(0,0,0,0.3); }
[data-bpmnkit-hud-theme="light"] .bpmnkit-runner-tests-edit:hover { color: var(--bpmnkit-accent, #1a56db); }

/* ── Chaos run summary banner ─────────────────────────────────────────────── */
.bpmnkit-runner-chaos-summary {
  font-size: 11px;
  padding: 6px 10px;
  margin-bottom: 8px;
  border-radius: 5px;
  background: rgba(245,158,11,0.12);
  border: 1px solid var(--bpmnkit-warn, #f59e0b);
  color: var(--bpmnkit-warn, #f59e0b);
}
`

export function injectProcessRunnerStyles(): void {
	if (typeof document === "undefined") return
	if (document.getElementById(STYLE_ID) !== null) return
	const style = document.createElement("style")
	style.id = STYLE_ID
	style.textContent = CSS
	document.head.appendChild(style)
}
