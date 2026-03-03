import type { CanvasApi, CanvasPlugin } from "@bpmn-sdk/canvas";
import { injectProcessRunnerStyles } from "./css.js";

// ── Structural types — no hard deps on engine packages ─────────────────────

/** Minimal interface satisfied by `ProcessInstance` from `@bpmn-sdk/engine`. */
interface InstanceLike {
	get state(): string;
	onChange(callback: (event: Record<string, unknown>) => void): () => void;
	cancel(): void;
	beforeComplete?: (elementId: string) => Promise<void>;
}

/** Minimal interface satisfied by `Engine` from `@bpmn-sdk/engine`. */
interface EngineLike {
	deploy(d: { bpmn: unknown }): void;
	start(
		processId: string,
		variables?: Record<string, unknown>,
		options?: { beforeComplete?: (elementId: string) => Promise<void> },
	): InstanceLike;
	getDeployedProcesses(): string[];
}

/** Minimal interface satisfied by the token-highlight plugin. */
interface TokenHighlightLike {
	api: {
		trackInstance(instance: {
			onChange(callback: (event: Record<string, unknown>) => void): () => void;
		}): () => void;
		clear(): void;
	};
}

// ── Public API ──────────────────────────────────────────────────────────────

export interface ProcessRunnerOptions {
	/** The engine instance used to deploy and execute processes. */
	engine: EngineLike;
	/**
	 * Optional token-highlight plugin. When provided, the executed process will
	 * be highlighted in real-time as the instance runs.
	 */
	tokenHighlight?: TokenHighlightLike;
}

// ── Internal state ──────────────────────────────────────────────────────────

type RunMode = "idle" | "running-auto" | "running-step";

// ── Plugin factory ──────────────────────────────────────────────────────────

export function createProcessRunnerPlugin(options: ProcessRunnerOptions): CanvasPlugin {
	const { engine } = options;

	let canvasApi: CanvasApi | null = null;
	let currentInstance: InstanceLike | null = null;
	let stopTrackHighlight: (() => void) | undefined;
	let mode: RunMode = "idle";

	/** Pending step resolvers — each represents a paused beforeComplete call. */
	const stepQueue: Array<() => void> = [];

	let toolbarEl: HTMLDivElement | null = null;
	let dropdownEl: HTMLDivElement | null = null;
	let modalOverlayEl: HTMLDivElement | null = null;

	const unsubs: Array<() => void> = [];

	// ── Helpers ────────────────────────────────────────────────────────────

	function getPrimaryProcessId(): string | undefined {
		return engine.getDeployedProcesses()[0];
	}

	function cleanup(): void {
		currentInstance?.cancel();
		currentInstance = null;
		stopTrackHighlight?.();
		stopTrackHighlight = undefined;
		stepQueue.length = 0;
		options.tokenHighlight?.api.clear();
		mode = "idle";
		updateToolbar();
	}

	function startInstance(vars?: Record<string, unknown>, stepMode = false): void {
		if (currentInstance !== null) cleanup();

		const processId = getPrimaryProcessId();
		if (processId === undefined) return;

		mode = stepMode ? "running-step" : "running-auto";
		updateToolbar();

		const beforeComplete = stepMode
			? (elementId: string): Promise<void> => {
					void elementId; // structural — elementId available for future use
					return new Promise<void>((resolve) => {
						stepQueue.push(resolve);
						updateToolbar();
					});
				}
			: undefined;

		const instance = engine.start(
			processId,
			vars,
			beforeComplete !== undefined ? { beforeComplete } : undefined,
		);
		currentInstance = instance;

		if (options.tokenHighlight !== undefined) {
			stopTrackHighlight = options.tokenHighlight.api.trackInstance(instance);
		}

		instance.onChange((evt) => {
			const type = evt.type;
			if (type === "process:completed" || type === "process:failed") {
				stopTrackHighlight?.();
				stopTrackHighlight = undefined;
				currentInstance = null;
				stepQueue.length = 0;
				mode = "idle";
				updateToolbar();
			}
		});
	}

	// ── Toolbar rendering ──────────────────────────────────────────────────

	function btn(label: string, extraClass?: string): HTMLButtonElement {
		const b = document.createElement("button");
		b.className = extraClass !== undefined ? `bpmn-runner-btn ${extraClass}` : "bpmn-runner-btn";
		b.textContent = label;
		return b;
	}

	function updateToolbar(): void {
		if (toolbarEl === null) return;
		// Clear children
		while (toolbarEl.firstChild !== null) {
			toolbarEl.removeChild(toolbarEl.firstChild);
		}

		if (mode === "idle") {
			renderIdleToolbar();
		} else if (mode === "running-auto") {
			renderRunningAutoToolbar();
		} else {
			renderRunningStepToolbar();
		}
	}

	function renderIdleToolbar(): void {
		if (toolbarEl === null) return;

		// ── Split play button ──────────────────────────────────────────────
		const split = document.createElement("div");
		split.className = "bpmn-runner-split";

		const playBtn = btn("\u25B6 Play");

		// Long-press (500 ms) → dropdown; short click → run
		let pressTimer: ReturnType<typeof setTimeout> | null = null;

		playBtn.addEventListener("mousedown", () => {
			pressTimer = setTimeout(() => {
				pressTimer = null;
				showDropdown(split);
			}, 500);
		});
		playBtn.addEventListener("mouseup", () => {
			if (pressTimer !== null) {
				clearTimeout(pressTimer);
				pressTimer = null;
				hideDropdown();
				startInstance();
			}
		});
		playBtn.addEventListener("mouseleave", () => {
			if (pressTimer !== null) {
				clearTimeout(pressTimer);
				pressTimer = null;
			}
		});

		const chevronBtn = btn("\u25BE", "bpmn-runner-btn--divider");
		chevronBtn.addEventListener("click", () => {
			if (dropdownEl !== null && dropdownEl.parentElement === split) {
				hideDropdown();
			} else {
				showDropdown(split);
			}
		});

		split.appendChild(playBtn);
		split.appendChild(chevronBtn);
		toolbarEl.appendChild(split);

		// ── Step button ────────────────────────────────────────────────────
		const stepBtn = btn("\u21A6 Step", "bpmn-runner-btn--step");
		stepBtn.addEventListener("click", () => {
			startInstance(undefined, true);
		});
		toolbarEl.appendChild(stepBtn);
	}

	function renderRunningAutoToolbar(): void {
		if (toolbarEl === null) return;
		const stopBtn = btn("\u25A0 Stop", "bpmn-runner-btn--stop");
		stopBtn.addEventListener("click", cleanup);
		toolbarEl.appendChild(stopBtn);
	}

	function renderRunningStepToolbar(): void {
		if (toolbarEl === null) return;

		const stopBtn = btn("\u25A0 Stop", "bpmn-runner-btn--stop");
		stopBtn.addEventListener("click", cleanup);
		toolbarEl.appendChild(stopBtn);

		const isPending = stepQueue.length > 0;
		let stepClass: string;
		let stepLabel: string;

		if (isPending) {
			stepClass = "bpmn-runner-btn--step-pending";
			stepLabel = "\u2192 Next";
		} else {
			stepClass = "bpmn-runner-btn--step-waiting";
			stepLabel = "\u21A6 Step";
		}

		const nextBtn = btn(stepLabel, stepClass);
		nextBtn.disabled = !isPending;
		nextBtn.addEventListener("click", () => {
			const next = stepQueue.shift();
			if (next !== undefined) {
				next();
				updateToolbar();
			}
		});
		toolbarEl.appendChild(nextBtn);
	}

	// ── Dropdown ───────────────────────────────────────────────────────────

	function showDropdown(parent: HTMLElement): void {
		hideDropdown();

		const theme = canvasApi?.getTheme() === "dark" ? "dark" : "light";

		const dd = document.createElement("div");
		dd.className = "bpmn-runner-dropdown";
		if (theme === "dark") dd.dataset.theme = "dark";

		const playItem = document.createElement("button");
		playItem.className = "bpmn-runner-dropdown-item";
		playItem.textContent = "\u25B6 Play";
		playItem.addEventListener("click", () => {
			hideDropdown();
			startInstance();
		});

		const payloadItem = document.createElement("button");
		payloadItem.className = "bpmn-runner-dropdown-item";
		payloadItem.textContent = "\u25B6 Play with payload\u2026";
		payloadItem.addEventListener("click", () => {
			hideDropdown();
			showPayloadModal();
		});

		dd.appendChild(playItem);
		dd.appendChild(payloadItem);
		parent.appendChild(dd);
		dropdownEl = dd;

		const onOutsideClick = (e: MouseEvent): void => {
			const target = e.target;
			if (target instanceof Node && !dd.contains(target) && !parent.contains(target)) {
				hideDropdown();
				document.removeEventListener("mousedown", onOutsideClick);
			}
		};
		// Defer so the current click doesn't immediately close it
		setTimeout(() => document.addEventListener("mousedown", onOutsideClick), 0);
	}

	function hideDropdown(): void {
		dropdownEl?.remove();
		dropdownEl = null;
	}

	// ── Payload modal ──────────────────────────────────────────────────────

	function showPayloadModal(): void {
		if (modalOverlayEl !== null) return;

		const theme = canvasApi?.getTheme() === "dark" ? "dark" : "light";

		const overlay = document.createElement("div");
		overlay.className = "bpmn-runner-modal-overlay";

		const modal = document.createElement("div");
		modal.className = "bpmn-runner-modal";
		if (theme === "dark") modal.dataset.theme = "dark";

		const title = document.createElement("h3");
		title.className = "bpmn-runner-modal-title";
		title.textContent = "Execute with JSON Payload";

		const textarea = document.createElement("textarea");
		textarea.className = "bpmn-runner-modal-textarea";
		textarea.placeholder = '{\n  "amount": 100\n}';

		const errorEl = document.createElement("div");
		errorEl.className = "bpmn-runner-modal-error";

		const actions = document.createElement("div");
		actions.className = "bpmn-runner-modal-actions";

		const cancelBtn = document.createElement("button");
		cancelBtn.className = "bpmn-runner-modal-btn bpmn-runner-modal-btn--cancel";
		cancelBtn.textContent = "Cancel";
		cancelBtn.addEventListener("click", closeModal);

		const runBtn = document.createElement("button");
		runBtn.className = "bpmn-runner-modal-btn bpmn-runner-modal-btn--run";
		runBtn.textContent = "Run";
		runBtn.addEventListener("click", () => {
			const text = textarea.value.trim();
			let vars: Record<string, unknown> = {};
			if (text !== "") {
				let parsed: unknown;
				try {
					parsed = JSON.parse(text);
				} catch {
					errorEl.textContent = "Invalid JSON.";
					return;
				}
				if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
					errorEl.textContent = "Payload must be a JSON object.";
					return;
				}
				vars = parsed as Record<string, unknown>;
			}
			closeModal();
			startInstance(vars);
		});

		actions.appendChild(cancelBtn);
		actions.appendChild(runBtn);
		modal.appendChild(title);
		modal.appendChild(textarea);
		modal.appendChild(errorEl);
		modal.appendChild(actions);
		overlay.appendChild(modal);

		overlay.addEventListener("click", (e) => {
			if (e.target === overlay) closeModal();
		});

		document.body.appendChild(overlay);
		modalOverlayEl = overlay;
		textarea.focus();
	}

	function closeModal(): void {
		modalOverlayEl?.remove();
		modalOverlayEl = null;
	}

	// ── CanvasPlugin ───────────────────────────────────────────────────────

	return {
		name: "process-runner",

		install(api: CanvasApi) {
			canvasApi = api;
			injectProcessRunnerStyles();

			// Ensure the container is positioned so the toolbar can be absolute
			const cs = window.getComputedStyle(api.container);
			if (cs.position === "static") {
				api.container.style.position = "relative";
			}

			const bar = document.createElement("div");
			bar.className = "bpmn-runner-toolbar";
			api.container.appendChild(bar);
			toolbarEl = bar;
			updateToolbar();

			unsubs.push(
				api.on("diagram:load", (defs) => {
					engine.deploy({ bpmn: defs });
					if (currentInstance !== null) cleanup();
					updateToolbar();
				}),
				api.on("diagram:clear", () => {
					if (currentInstance !== null) cleanup();
					updateToolbar();
				}),
			);
		},

		uninstall() {
			for (const off of unsubs) off();
			cleanup();
			toolbarEl?.remove();
			toolbarEl = null;
			hideDropdown();
			closeModal();
			canvasApi = null;
		},
	};
}
