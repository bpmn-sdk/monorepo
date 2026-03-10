const CSS = `
/* ── Root variables ─────────────────────────────────────────────────────── */
.op-root {
  --op-nav-bg: #1a1a2e;
  --op-nav-fg: #c8c8d4;
  --op-nav-fg-active: #fff;
  --op-nav-accent: #7b61ff;
  --op-nav-width: 220px;
  --op-header-height: 52px;
  --op-bg: #0f0f1a;
  --op-surface: #1a1a2e;
  --op-surface-2: #222240;
  --op-border: #2e2e4e;
  --op-fg: #e0e0f0;
  --op-fg-muted: #8888a8;
  --op-accent: #7b61ff;
  --op-warn: #f59e0b;
  --op-danger: #ef4444;
  --op-success: #22c55e;
  --op-radius: 6px;
  --op-font: system-ui, -apple-system, sans-serif;
  font-family: var(--op-font);
  font-size: 13px;
  color: var(--op-fg);
  background: var(--op-bg);
}
.op-root[data-theme="light"] {
  --op-nav-bg: #1e1e3f;
  --op-bg: #f4f4f8;
  --op-surface: #fff;
  --op-surface-2: #f0f0f8;
  --op-border: #d8d8e8;
  --op-fg: #1a1a2e;
  --op-fg-muted: #6666a0;
}

/* ── Layout ─────────────────────────────────────────────────────────────── */
.op-layout {
  display: flex;
  height: 100%;
  overflow: hidden;
}
.op-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.op-content {
  flex: 1;
  overflow-y: auto;
  padding: 20px 24px;
}

/* ── Nav ─────────────────────────────────────────────────────────────────── */
.op-nav {
  width: var(--op-nav-width);
  background: var(--op-nav-bg);
  display: flex;
  flex-direction: column;
  padding: 0;
  flex-shrink: 0;
  border-right: 1px solid rgba(255,255,255,0.06);
}
.op-nav-logo {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 16px 20px;
  font-size: 14px;
  font-weight: 600;
  color: #fff;
  letter-spacing: 0.02em;
  border-bottom: 1px solid rgba(255,255,255,0.06);
  margin-bottom: 8px;
}
.op-nav-list {
  list-style: none;
  padding: 4px 10px;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.op-nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 8px 12px;
  background: none;
  border: none;
  border-radius: 6px;
  color: var(--op-nav-fg);
  font-size: 13px;
  cursor: pointer;
  text-align: left;
  transition: background 0.15s, color 0.15s;
}
.op-nav-item:hover {
  background: rgba(255,255,255,0.06);
  color: var(--op-nav-fg-active);
}
.op-nav-item--active {
  background: rgba(123,97,255,0.18);
  color: var(--op-nav-fg-active);
}
.op-nav-icon {
  font-size: 14px;
  opacity: 0.9;
  width: 18px;
  text-align: center;
}

/* ── Header ─────────────────────────────────────────────────────────────── */
.op-header {
  height: var(--op-header-height);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  background: var(--op-surface);
  border-bottom: 1px solid var(--op-border);
  flex-shrink: 0;
}
.op-header-title {
  font-size: 16px;
  font-weight: 600;
  margin: 0;
}
.op-header-right {
  display: flex;
  align-items: center;
  gap: 12px;
}
.op-profile-select {
  background: var(--op-surface-2);
  color: var(--op-fg);
  border: 1px solid var(--op-border);
  border-radius: var(--op-radius);
  padding: 5px 10px;
  font-size: 12px;
  cursor: pointer;
  outline: none;
}
.op-profile-select:focus {
  border-color: var(--op-accent);
}

/* ── Stats cards ─────────────────────────────────────────────────────────── */
.op-card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 16px;
  margin-bottom: 28px;
}
.op-card {
  background: var(--op-surface);
  border: 1px solid var(--op-border);
  border-radius: 10px;
  padding: 20px 18px;
  transition: border-color 0.15s;
}
.op-card--clickable {
  cursor: pointer;
}
.op-card--clickable:hover {
  border-color: var(--op-accent);
}
.op-card--warn .op-card-value {
  color: var(--op-warn);
}
.op-card-value {
  font-size: 28px;
  font-weight: 700;
  line-height: 1;
  color: var(--op-accent);
  margin-bottom: 6px;
}
.op-card-label {
  font-size: 12px;
  color: var(--op-fg-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

/* ── Table ───────────────────────────────────────────────────────────────── */
.op-table-wrap {
  background: var(--op-surface);
  border: 1px solid var(--op-border);
  border-radius: var(--op-radius);
  overflow: hidden;
}
.op-table-header {
  display: flex;
  background: var(--op-surface-2);
  border-bottom: 1px solid var(--op-border);
}
.op-table-th {
  padding: 9px 14px;
  font-size: 11px;
  font-weight: 600;
  color: var(--op-fg-muted);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.op-table-th[style*="width"] {
  flex: none;
}
.op-table-body {
  overflow-y: auto;
  max-height: calc(100vh - 240px);
}
.op-table-row {
  display: flex;
  align-items: center;
  border-bottom: 1px solid var(--op-border);
  transition: background 0.1s;
}
.op-table-row:last-child {
  border-bottom: none;
}
.op-table-row--clickable {
  cursor: pointer;
}
.op-table-row--clickable:hover {
  background: var(--op-surface-2);
}
.op-table-td {
  padding: 10px 14px;
  font-size: 13px;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.op-table-td[style*="width"] {
  flex: none;
}
.op-table-empty {
  padding: 28px 20px;
  text-align: center;
  color: var(--op-fg-muted);
  font-size: 13px;
}

/* ── Badges ──────────────────────────────────────────────────────────────── */
.op-badge {
  display: inline-block;
  padding: 2px 7px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
  background: var(--op-surface-2);
  color: var(--op-fg-muted);
  text-transform: uppercase;
  white-space: nowrap;
}
.op-badge--active    { background: rgba(34,197,94,0.15); color: #22c55e; }
.op-badge--completed { background: rgba(99,102,241,0.15); color: #a5b4fc; }
.op-badge--terminated { background: rgba(239,68,68,0.15); color: #f87171; }
.op-badge--failed    { background: rgba(239,68,68,0.15); color: #f87171; }
.op-badge--error_thrown { background: rgba(239,68,68,0.15); color: #f87171; }
.op-badge--created   { background: rgba(59,130,246,0.15); color: #93c5fd; }
.op-badge--resolved  { background: rgba(34,197,94,0.15); color: #86efac; }
.op-badge--pending   { background: rgba(245,158,11,0.18); color: #fbbf24; }
.op-badge--migrated  { background: rgba(139,92,246,0.15); color: #c4b5fd; }
.op-badge--timed_out { background: rgba(245,158,11,0.18); color: #fbbf24; }
.op-badge--retries_updated { background: rgba(59,130,246,0.15); color: #93c5fd; }
.op-badge--tenant    { background: rgba(255,255,255,0.06); color: var(--op-fg-muted); font-weight: 400; }
.op-badge--incident-dot { background: rgba(245,158,11,0.18); color: var(--op-warn); margin-left: 6px; padding: 2px 5px; }
.op-badge-wrap { display: flex; align-items: center; }

/* ── Filter bar ──────────────────────────────────────────────────────────── */
.op-filter-bar {
  display: flex;
  gap: 6px;
  margin-bottom: 14px;
}
.op-filter-btn {
  background: var(--op-surface);
  border: 1px solid var(--op-border);
  border-radius: 20px;
  padding: 4px 14px;
  font-size: 12px;
  color: var(--op-fg-muted);
  cursor: pointer;
  transition: border-color 0.15s, color 0.15s;
}
.op-filter-btn:hover {
  color: var(--op-fg);
  border-color: var(--op-accent);
}
.op-filter-btn--active {
  background: rgba(123,97,255,0.15);
  border-color: var(--op-accent);
  color: var(--op-fg);
}

/* ── Loading ─────────────────────────────────────────────────────────────── */
.op-loading {
  padding: 40px;
  text-align: center;
  color: var(--op-fg-muted);
  font-size: 13px;
}

/* ── Instance detail ─────────────────────────────────────────────────────── */
.op-instance-detail {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}
.op-breadcrumb {
  margin-bottom: 10px;
}
.op-back-btn {
  background: none;
  border: none;
  color: var(--op-accent);
  cursor: pointer;
  font-size: 13px;
  padding: 0;
}
.op-back-btn:hover { text-decoration: underline; }
.op-instance-meta {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 14px;
  flex-wrap: wrap;
}
.op-instance-key {
  font-family: monospace;
  font-size: 12px;
  color: var(--op-fg-muted);
  background: var(--op-surface-2);
  padding: 2px 8px;
  border-radius: 4px;
}
.op-instance-biz {
  font-weight: 600;
  color: var(--op-fg);
}
.op-instance-time {
  font-size: 12px;
  color: var(--op-fg-muted);
}
.op-detail-layout {
  display: flex;
  flex: 1;
  gap: 16px;
  overflow: hidden;
  min-height: 0;
}
.op-detail-canvas {
  flex: 1;
  background: var(--op-surface);
  border: 1px solid var(--op-border);
  border-radius: var(--op-radius);
  overflow: hidden;
  min-height: 0;
}
.op-detail-sidebar {
  width: 320px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  background: var(--op-surface);
  border: 1px solid var(--op-border);
  border-radius: var(--op-radius);
  overflow: hidden;
}
.op-detail-tabs {
  display: flex;
  border-bottom: 1px solid var(--op-border);
}
.op-detail-tab {
  flex: 1;
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  padding: 10px 16px;
  font-size: 12px;
  font-weight: 600;
  color: var(--op-fg-muted);
  cursor: pointer;
  transition: color 0.15s, border-color 0.15s;
}
.op-detail-tab:hover { color: var(--op-fg); }
.op-detail-tab--active {
  color: var(--op-fg);
  border-bottom-color: var(--op-accent);
}
.op-detail-panel {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
}
.op-var-list { display: flex; flex-direction: column; gap: 4px; }
.op-var-row { padding: 6px 10px; border-radius: 4px; background: var(--op-surface-2); }
.op-var-name { font-family: monospace; font-size: 12px; color: var(--op-fg); }
.op-panel-empty { padding: 20px; text-align: center; color: var(--op-fg-muted); font-size: 12px; }
.op-incident-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px 10px;
  border-radius: 4px;
  background: var(--op-surface-2);
  margin-bottom: 6px;
}
.op-incident-type { font-size: 11px; font-weight: 600; color: var(--op-warn); text-transform: uppercase; }
.op-incident-msg { font-size: 12px; color: var(--op-fg); line-height: 1.4; }

/* ── Misc ────────────────────────────────────────────────────────────────── */
.op-cell-error {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--op-danger);
  font-size: 12px;
}
.op-incident-msg-cell {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
}
.op-view { height: 100%; }
.op-dashboard { height: auto; }
`

let injected = false

export function injectOperateStyles(): void {
	if (injected) return
	injected = true
	const style = document.createElement("style")
	style.textContent = CSS
	document.head.appendChild(style)
}
