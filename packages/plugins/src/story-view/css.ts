export const STYLE_ID = "bpmnkit-story-view-v1"

export const CSS = `
/* ── Container ──────────────────────────────────────────────────────────────── */
.bpmnkit-sv-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--bpmnkit-bg, #0d0d16);
  color: var(--bpmnkit-fg, #cdd6f4);
  font-family: var(--bpmnkit-font, system-ui, -apple-system, sans-serif);
  font-size: 13px;
}

/* ── Header ─────────────────────────────────────────────────────────────────── */
.bpmnkit-sv-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  border-bottom: 1px solid var(--bpmnkit-border, #2a2a42);
  flex-shrink: 0;
}
.bpmnkit-sv-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--bpmnkit-fg, #cdd6f4);
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.bpmnkit-sv-back {
  font-size: 11px;
  padding: 3px 10px;
  border-radius: 5px;
  border: 1px solid var(--bpmnkit-border, #2a2a42);
  background: var(--bpmnkit-surface-2, #1e1e2e);
  color: var(--bpmnkit-fg-muted, #8888a8);
  cursor: pointer;
  font-weight: 600;
  white-space: nowrap;
}
.bpmnkit-sv-back:hover {
  color: var(--bpmnkit-accent, #6b9df7);
  border-color: var(--bpmnkit-accent, #6b9df7);
}

/* ── Content ────────────────────────────────────────────────────────────────── */
.bpmnkit-sv-content {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

/* ── Lane ────────────────────────────────────────────────────────────────────── */
.bpmnkit-sv-lane {
  margin-bottom: 20px;
}
.bpmnkit-sv-lane-header {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--bpmnkit-fg-muted, #8888a8);
  padding: 4px 0 8px;
  border-bottom: 1px solid var(--bpmnkit-border, #2a2a42);
  margin-bottom: 10px;
}
.bpmnkit-sv-lane-cards {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 6px;
}

/* ── Cards ───────────────────────────────────────────────────────────────────── */
.bpmnkit-sv-card {
  background: var(--bpmnkit-surface, #161626);
  border: 1px solid var(--bpmnkit-border, #2a2a42);
  border-radius: 8px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.2);
  padding: 10px 12px;
  min-width: 120px;
  max-width: 200px;
  flex-shrink: 0;
}
.bpmnkit-sv-card--start  { border-left: 3px solid var(--bpmnkit-success, #22c55e); }
.bpmnkit-sv-card--end    { border-left: 3px solid var(--bpmnkit-fg-muted, #8888a8); }
.bpmnkit-sv-card--service { border-left: 3px solid var(--bpmnkit-accent, #6b9df7); }
.bpmnkit-sv-card--user   { border-left: 3px solid var(--bpmnkit-teal, #2dd4bf); }
.bpmnkit-sv-card--gateway { border-left: 3px solid var(--bpmnkit-warn, #f59e0b); }
.bpmnkit-sv-card--parallel { border-left: 3px solid var(--bpmnkit-fg-muted, #8888a8); }
.bpmnkit-sv-card--subprocess { border-left: 3px solid #a78bfa; }
.bpmnkit-sv-card--event  { border-left: 3px solid var(--bpmnkit-accent, #6b9df7); }
.bpmnkit-sv-card--task   { border-left: 3px solid var(--bpmnkit-border, #2a2a42); }

.bpmnkit-sv-card-header {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--bpmnkit-fg-muted, #8888a8);
  margin-bottom: 3px;
}
.bpmnkit-sv-card-body {
  font-size: 12px;
  font-weight: 500;
  color: var(--bpmnkit-fg, #cdd6f4);
  word-break: break-word;
  min-height: 16px;
}

/* ── Arrow connector ─────────────────────────────────────────────────────────── */
.bpmnkit-sv-arrow {
  color: var(--bpmnkit-fg-muted, #8888a8);
  font-size: 18px;
  align-self: center;
  flex-shrink: 0;
  padding: 0 2px;
  margin-top: 12px;
}

/* ── Comment button ─────────────────────────────────────────────────────────── */
.bpmnkit-sv-comment-btn {
  display: inline-block;
  margin-top: 6px;
  font-size: 10px;
  padding: 2px 7px;
  border-radius: 4px;
  border: 1px solid var(--bpmnkit-border, #2a2a42);
  background: transparent;
  color: var(--bpmnkit-fg-muted, #8888a8);
  cursor: pointer;
}
.bpmnkit-sv-comment-btn:hover {
  border-color: var(--bpmnkit-accent, #6b9df7);
  color: var(--bpmnkit-accent, #6b9df7);
}

/* ── Comment panel ─────────────────────────────────────────────────────────── */
.bpmnkit-sv-comment-panel {
  margin-top: 8px;
  border-top: 1px solid var(--bpmnkit-border, #2a2a42);
  padding-top: 8px;
}
.bpmnkit-sv-comment-item {
  padding: 4px 0;
  border-bottom: 1px solid var(--bpmnkit-border, #2a2a42);
}
.bpmnkit-sv-comment-item:last-child {
  border-bottom: none;
}
.bpmnkit-sv-comment-text {
  font-size: 11px;
  color: var(--bpmnkit-fg, #cdd6f4);
  line-height: 1.45;
}
.bpmnkit-sv-comment-meta {
  font-size: 10px;
  color: var(--bpmnkit-fg-muted, #8888a8);
  margin-top: 2px;
}
.bpmnkit-sv-comment-input {
  width: 100%;
  margin-top: 6px;
  padding: 5px 8px;
  border-radius: 5px;
  border: 1px solid var(--bpmnkit-border, #2a2a42);
  background: var(--bpmnkit-surface-2, #1e1e2e);
  color: var(--bpmnkit-fg, #cdd6f4);
  font-family: var(--bpmnkit-font, system-ui, -apple-system, sans-serif);
  font-size: 11px;
  resize: vertical;
  min-height: 50px;
}
.bpmnkit-sv-comment-submit {
  margin-top: 5px;
  font-size: 11px;
  padding: 3px 10px;
  border-radius: 5px;
  border: 1px solid var(--bpmnkit-accent, #6b9df7);
  background: var(--bpmnkit-accent-subtle, rgba(107,157,247,0.15));
  color: var(--bpmnkit-accent, #6b9df7);
  cursor: pointer;
  font-weight: 600;
}
.bpmnkit-sv-comment-submit:hover {
  background: var(--bpmnkit-accent, #6b9df7);
  color: #fff;
}

/* ── Light theme overrides ─────────────────────────────────────────────────── */
[data-bpmnkit-theme="light"] .bpmnkit-sv-container {
  background: var(--bpmnkit-bg, #f4f4f8);
  color: var(--bpmnkit-fg, #1a1a2e);
}
[data-bpmnkit-theme="light"] .bpmnkit-sv-card {
  background: var(--bpmnkit-surface, #ffffff);
}
[data-bpmnkit-theme="light"] .bpmnkit-sv-card--start  { border-left-color: var(--bpmnkit-success, #16a34a); }
[data-bpmnkit-theme="light"] .bpmnkit-sv-card--service { border-left-color: var(--bpmnkit-accent, #1a56db); }
[data-bpmnkit-theme="light"] .bpmnkit-sv-card--user   { border-left-color: var(--bpmnkit-teal, #0d9488); }
[data-bpmnkit-theme="light"] .bpmnkit-sv-card--gateway { border-left-color: var(--bpmnkit-warn, #d97706); }
[data-bpmnkit-theme="light"] .bpmnkit-sv-card--subprocess { border-left-color: #7c3aed; }

/* ── Share/download button ─────────────────────────────────────────────────── */
.bpmnkit-sv-share {
  font-size: 11px;
  padding: 3px 10px;
  border-radius: 5px;
  border: 1px solid var(--bpmnkit-border, #2a2a42);
  background: var(--bpmnkit-surface-2, #1e1e2e);
  color: var(--bpmnkit-fg-muted, #8888a8);
  cursor: pointer;
  font-weight: 600;
  white-space: nowrap;
  margin-left: auto;
}
.bpmnkit-sv-share:hover {
  color: var(--bpmnkit-accent, #6b9df7);
  border-color: var(--bpmnkit-accent, #6b9df7);
}

/* ── Resolve button ─────────────────────────────────────────────────────────── */
.bpmnkit-sv-comment-resolve {
  font-size: 10px;
  padding: 2px 7px;
  border-radius: 4px;
  border: 1px solid var(--bpmnkit-border, #2a2a42);
  background: transparent;
  color: var(--bpmnkit-fg-muted, #8888a8);
  cursor: pointer;
  margin-top: 3px;
}
.bpmnkit-sv-comment-resolve:hover {
  border-color: var(--bpmnkit-success, #22c55e);
  color: var(--bpmnkit-success, #22c55e);
}
.bpmnkit-sv-comment-item--resolved .bpmnkit-sv-comment-text {
  text-decoration: line-through;
  opacity: 0.5;
}
.bpmnkit-sv-comment-item--resolved .bpmnkit-sv-comment-meta {
  opacity: 0.5;
}
.bpmnkit-sv-comment-item--resolved .bpmnkit-sv-comment-resolve {
  border-color: var(--bpmnkit-success, #22c55e);
  color: var(--bpmnkit-success, #22c55e);
}
`

export function injectStoryViewStyles(): void {
	if (document.getElementById(STYLE_ID) !== null) return
	const style = document.createElement("style")
	style.id = STYLE_ID
	style.textContent = CSS
	document.head.appendChild(style)
}
