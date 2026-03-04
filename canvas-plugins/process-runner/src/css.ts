const STYLE_ID = "bpmn-process-runner-v1";

const CSS = `
/* ── Toolbar ──────────────────────────────────────────────────────────── */
.bpmn-runner-toolbar {
  display: flex;
  gap: 6px;
  align-items: center;
}

/* HUD bottom-center placement (used when toolbar replaces #hud-bottom-center) */
.bpmn-runner-toolbar--hud-bottom {
  position: fixed;
  z-index: 100;
  bottom: 10px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(22, 22, 30, 0.88);
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 8px;
  backdrop-filter: blur(12px);
  padding: 4px;
  gap: 4px;
}

/* ── Split play button ────────────────────────────────────────────────── */
.bpmn-runner-split {
  display: flex;
  border-radius: 6px;
  overflow: visible;
  position: relative;
}

.bpmn-runner-btn {
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
.bpmn-runner-btn:first-child {
  border-radius: 6px 0 0 6px;
}
.bpmn-runner-split .bpmn-runner-btn:last-child {
  border-radius: 0 6px 6px 0;
  border-left: 1px solid rgba(255,255,255,0.25);
  padding: 6px 9px;
}
.bpmn-runner-btn:only-child {
  border-radius: 6px;
}
.bpmn-runner-btn:hover:not(:disabled) {
  background: #1d4ed8;
}
.bpmn-runner-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Stop */
.bpmn-runner-btn--stop {
  background: #dc2626;
  border-radius: 6px;
}
.bpmn-runner-btn--stop:hover {
  background: #b91c1c;
}

/* Step (idle: start step mode) */
.bpmn-runner-btn--step {
  background: #7c3aed;
  border-radius: 6px;
}
.bpmn-runner-btn--step:hover:not(:disabled) {
  background: #6d28d9;
}

/* Step pending (running-step, user can advance) */
.bpmn-runner-btn--step-pending {
  background: #d97706;
  border-radius: 6px;
}
.bpmn-runner-btn--step-pending:hover {
  background: #b45309;
}

/* Step waiting (running-step, process is mid-execution, not paused yet) */
.bpmn-runner-btn--step-waiting {
  background: #6b7280;
  border-radius: 6px;
}

/* Exit play mode */
.bpmn-runner-btn--exit {
  background: #374151;
  border-radius: 6px;
}
.bpmn-runner-btn--exit:hover {
  background: #4b5563;
}

/* ── Dropdown menu ────────────────────────────────────────────────────── */
.bpmn-runner-dropdown {
  position: fixed;
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  box-shadow: 0 4px 16px rgba(0,0,0,0.15);
  min-width: 190px;
  z-index: 20;
  overflow: hidden;
}
.bpmn-runner-dropdown[data-theme="dark"] {
  background: #1f2937;
  border-color: #374151;
  color: #f9fafb;
}

.bpmn-runner-dropdown-item {
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
.bpmn-runner-dropdown-item:hover {
  background: #f3f4f6;
}
.bpmn-runner-dropdown[data-theme="dark"] .bpmn-runner-dropdown-item:hover {
  background: #374151;
}

/* ── Payload modal ────────────────────────────────────────────────────── */
.bpmn-runner-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.45);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
}

.bpmn-runner-modal {
  background: #ffffff;
  border-radius: 10px;
  padding: 24px;
  width: 480px;
  max-width: 90vw;
  box-shadow: 0 20px 60px rgba(0,0,0,0.3);
  font-family: inherit;
}
.bpmn-runner-modal[data-theme="dark"] {
  background: #1f2937;
  color: #f9fafb;
}

.bpmn-runner-modal-title {
  font-size: 15px;
  font-weight: 600;
  margin: 0 0 14px;
}

.bpmn-runner-modal-textarea {
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
.bpmn-runner-modal[data-theme="dark"] .bpmn-runner-modal-textarea {
  background: #111827;
  border-color: #374151;
  color: #f9fafb;
}

.bpmn-runner-modal-error {
  color: #dc2626;
  font-size: 12px;
  margin-top: 6px;
  min-height: 18px;
}

.bpmn-runner-modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 18px;
}

.bpmn-runner-modal-btn {
  padding: 7px 18px;
  border-radius: 6px;
  border: none;
  cursor: pointer;
  font-size: 13px;
  font-family: inherit;
  font-weight: 500;
}
.bpmn-runner-modal-btn--cancel {
  background: #f3f4f6;
  color: #374151;
}
.bpmn-runner-modal-btn--cancel:hover {
  background: #e5e7eb;
}
.bpmn-runner-modal[data-theme="dark"] .bpmn-runner-modal-btn--cancel {
  background: #374151;
  color: #f9fafb;
}
.bpmn-runner-modal-btn--run {
  background: #2563eb;
  color: #fff;
}
.bpmn-runner-modal-btn--run:hover {
  background: #1d4ed8;
}
`;

export function injectProcessRunnerStyles(): void {
	if (typeof document === "undefined") return;
	if (document.getElementById(STYLE_ID) !== null) return;
	const style = document.createElement("style");
	style.id = STYLE_ID;
	style.textContent = CSS;
	document.head.appendChild(style);
}
