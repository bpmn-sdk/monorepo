// Internal SVG icon strings — not exported from index.ts
export const IC = {
	// ── Navigation tools ───────────────────────────────────────────────────
	select: `<svg viewBox="0 0 16 16" fill="currentColor"><path d="M3 2 3 12.5 5.5 9.5 7.5 14 9.5 13.2 7.5 8.8 12 8.8z"/></svg>`,
	hand: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><path d="M9 2v6M11.5 3v5M14 5.5V8.5a5.5 5.5 0 01-11 0V5a1.5 1.5 0 013 0v3"/></svg>`,

	// ── History (U-shape curved arrows) ────────────────────────────────────
	undo: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 4H9.5a4.5 4.5 0 0 1 0 9H5"/><polyline points="8,1.5 5,4 8,6.5"/></svg>`,
	redo: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H6.5a4.5 4.5 0 0 0 0 9H11"/><polyline points="8,1.5 11,4 8,6.5"/></svg>`,

	// ── Edit actions ────────────────────────────────────────────────────────
	trash: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><line x1="3" y1="4" x2="13" y2="4"/><path d="M5.5 4V2.5h5V4M5 4l.5 9.5h5.1L11 4"/><line x1="6.5" y1="7" x2="6.5" y2="11.5"/><line x1="9.5" y1="7" x2="9.5" y2="11.5"/></svg>`,
	duplicate: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><rect x="5.5" y="5.5" width="8" height="8" rx="1.5"/><path d="M4 10.5V3.5A1.5 1.5 0 0 1 5.5 2H12"/></svg>`,
	dots: `<svg viewBox="0 0 16 16" fill="currentColor"><circle cx="3.5" cy="8" r="1.3"/><circle cx="8" cy="8" r="1.3"/><circle cx="12.5" cy="8" r="1.3"/></svg>`,
	arrow: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><line x1="2" y1="8" x2="11" y2="8"/><polyline points="8,5 12,8 8,11"/></svg>`,
	labelPos: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><circle cx="8" cy="8" r="1.5" fill="currentColor" stroke="none"/><line x1="8" y1="2" x2="8" y2="5.5"/><line x1="8" y1="10.5" x2="8" y2="14"/><line x1="2" y1="8" x2="5.5" y2="8"/><line x1="10.5" y1="8" x2="14" y2="8"/></svg>`,
	zoomIn: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><line x1="8" y1="3" x2="8" y2="13"/><line x1="3" y1="8" x2="13" y2="8"/></svg>`,
	zoomOut: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><line x1="3" y1="8" x2="13" y2="8"/></svg>`,

	// ── Space tool (two vertical bars with outward arrows) ─────────────────
	space: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="4" width="2.5" height="8" rx="0.8"/><rect x="12.5" y="4" width="2.5" height="8" rx="0.8"/><path d="M4 8h8"/><path d="M5.5 6.5 4 8 5.5 9.5"/><path d="M10.5 6.5 12 8 10.5 9.5"/></svg>`,

	// ── BPMN Events (circles: thin=start, thick=end) ────────────────────────
	startEvent: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3"><circle cx="8" cy="8" r="6.5"/></svg>`,
	endEvent: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="3"><circle cx="8" cy="8" r="5.5"/></svg>`,

	// ── BPMN Activities (rounded rect + type marker top-left) ──────────────
	task: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3"><rect x="0.5" y="2.5" width="15" height="11" rx="2"/></svg>`,
	serviceTask: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3"><rect x="0.5" y="2.5" width="15" height="11" rx="2"/><circle cx="4" cy="6" r="2.2" stroke-width="1.1"/><circle cx="4" cy="6" r="0.9" fill="currentColor" stroke="none"/><path d="M4 3.5v1M4 7.5v1M1.5 6h1M5.5 6h1" stroke-linecap="round" stroke-width="1.1"/></svg>`,
	userTask: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3"><rect x="0.5" y="2.5" width="15" height="11" rx="2"/><circle cx="4" cy="5.5" r="1.5" stroke-width="1.1"/><path d="M1 10Q1 7.5 4 7.5Q7 7.5 7 10" stroke-linecap="round" stroke-width="1.1"/></svg>`,
	scriptTask: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3"><rect x="0.5" y="2.5" width="15" height="11" rx="2"/><rect x="1" y="3.5" width="4.5" height="6" rx="0.5" stroke-width="1.1"/><path d="M2 5h2.5M2 6.5h2.5M2 8h1.5" stroke-linecap="round" stroke-width="1"/></svg>`,
	sendTask: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3"><rect x="0.5" y="2.5" width="15" height="11" rx="2"/><rect x="1" y="3.5" width="5.5" height="4" fill="currentColor" rx="0.3" stroke-width="1.1"/></svg>`,
	receiveTask: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3"><rect x="0.5" y="2.5" width="15" height="11" rx="2"/><rect x="1" y="3.5" width="5.5" height="4" rx="0.3" stroke-width="1.1"/><path d="M1 3.5l2.75 2 2.75-2" stroke-width="1.1"/></svg>`,
	businessRuleTask: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3"><rect x="0.5" y="2.5" width="15" height="11" rx="2"/><rect x="1" y="3.5" width="6" height="4.5" stroke-width="1.1"/><path d="M1 5.3h6M3 3.5v4.5" stroke-width="1.1"/></svg>`,

	// ── BPMN Gateways (diamond + type marker) ──────────────────────────────
	exclusiveGateway: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3"><polygon points="8,1.5 14.5,8 8,14.5 1.5,8"/><path d="M5.5 5.5l5 5M10.5 5.5l-5 5" stroke-linecap="round" stroke-width="1.5"/></svg>`,
	parallelGateway: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3"><polygon points="8,1.5 14.5,8 8,14.5 1.5,8"/><path d="M8 4.5v7M4.5 8h7" stroke-linecap="round" stroke-width="1.5"/></svg>`,
	inclusiveGateway: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3"><polygon points="8,1.5 14.5,8 8,14.5 1.5,8"/><circle cx="8" cy="8" r="3" stroke-width="1.5"/></svg>`,
	eventBasedGateway: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3"><polygon points="8,1.5 14.5,8 8,14.5 1.5,8"/><circle cx="8" cy="8" r="3.5" stroke-width="1"/><circle cx="8" cy="8" r="2" stroke-width="1"/></svg>`,
};
