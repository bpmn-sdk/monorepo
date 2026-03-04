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
	deploy(d: { bpmn?: unknown }): void;
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
	/** Called when the user enters play mode by clicking the Play trigger button. */
	onEnterPlayMode?: () => void;
	/** Called when the user exits play mode by clicking the Exit button. */
	onExitPlayMode?: () => void;
}

// ── Internal state ──────────────────────────────────────────────────────────

type RunMode = "idle" | "running-auto" | "running-step";

// ── Plugin factory ──────────────────────────────────────────────────────────

const PLAY_ICON =
	'<svg viewBox="0 0 16 16" fill="currentColor"><path d="M4 2.5l10 5.5-10 5.5V2.5z"/></svg>';

export function createProcessRunnerPlugin(
	options: ProcessRunnerOptions,
): CanvasPlugin & { toolbar: HTMLDivElement; playButton: HTMLButtonElement } {
	const { engine } = options;

	let canvasApi: CanvasApi | null = null;
	let currentInstance: InstanceLike | null = null;
	let stopTrackHighlight: (() => void) | undefined;
	let mode: RunMode = "idle";
	let playModeActive = false;

	/** Pending step resolvers — each represents a paused beforeComplete call. */
	const stepQueue: Array<() => void> = [];

	const toolbarEl = document.createElement("div");
	toolbarEl.className = "bpmn-runner-toolbar";

	/** Entry button placed in the HUD action bar (styled by initEditorHud). */
	const playButtonEl = document.createElement("button");
	playButtonEl.title = "Play mode";
	playButtonEl.innerHTML = PLAY_ICON;

	const unsubs: Array<() => void> = [];

	// ── Helpers ────────────────────────────────────────────────────────────

	function getPrimaryProcessId(): string | undefined {
		return engine.getDeployedProcesses()[0];
	}

	/** Cancel running instance and reset run state. Stays in play mode. */
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

	/** Exit play mode entirely (also cancels any running instance). */
	function exitPlayMode(): void {
		currentInstance?.cancel();
		currentInstance = null;
		stopTrackHighlight?.();
		stopTrackHighlight = undefined;
		stepQueue.length = 0;
		options.tokenHighlight?.api.clear();
		mode = "idle";
		playModeActive = false;
		updateToolbar();
		options.onExitPlayMode?.();
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

	playButtonEl.addEventListener("click", () => {
		playModeActive = true;
		updateToolbar();
		options.onEnterPlayMode?.();
	});

	function updateToolbar(): void {
		while (toolbarEl.firstChild !== null) {
			toolbarEl.removeChild(toolbarEl.firstChild);
		}

		// Hide the HUD entry button while in play mode
		playButtonEl.style.display = playModeActive ? "none" : "";

		if (playModeActive) {
			if (mode === "idle") {
				renderPlayIdleToolbar();
			} else if (mode === "running-auto") {
				renderPlayRunningAutoToolbar();
			} else {
				renderPlayRunningStepToolbar();
			}
		}
	}

	/** Play mode, idle: Run + One Step + Exit. */
	function renderPlayIdleToolbar(): void {
		const runBtn = btn("\u25B6 Run");
		runBtn.addEventListener("click", () => startInstance());
		toolbarEl.appendChild(runBtn);

		const stepBtn = btn("\u21A6 One Step", "bpmn-runner-btn--step");
		stepBtn.addEventListener("click", () => startInstance(undefined, true));
		toolbarEl.appendChild(stepBtn);

		const exitBtn = btn("Exit", "bpmn-runner-btn--exit");
		exitBtn.addEventListener("click", () => exitPlayMode());
		toolbarEl.appendChild(exitBtn);
	}

	/** Play mode, running auto: Cancel + Exit. */
	function renderPlayRunningAutoToolbar(): void {
		const cancelBtn = btn("\u25A0 Cancel", "bpmn-runner-btn--stop");
		cancelBtn.addEventListener("click", cleanup);
		toolbarEl.appendChild(cancelBtn);

		const exitBtn = btn("Exit", "bpmn-runner-btn--exit");
		exitBtn.addEventListener("click", () => exitPlayMode());
		toolbarEl.appendChild(exitBtn);
	}

	/** Play mode, running step: Next (or waiting) + Cancel + Exit. */
	function renderPlayRunningStepToolbar(): void {
		const isPending = stepQueue.length > 0;
		const nextBtn = btn(
			isPending ? "\u2192 Next" : "\u21A6 Step",
			isPending ? "bpmn-runner-btn--step-pending" : "bpmn-runner-btn--step-waiting",
		);
		nextBtn.disabled = !isPending;
		nextBtn.addEventListener("click", () => {
			const next = stepQueue.shift();
			if (next !== undefined) {
				next();
				updateToolbar();
			}
		});
		toolbarEl.appendChild(nextBtn);

		const cancelBtn = btn("\u25A0 Cancel", "bpmn-runner-btn--stop");
		cancelBtn.addEventListener("click", cleanup);
		toolbarEl.appendChild(cancelBtn);

		const exitBtn = btn("Exit", "bpmn-runner-btn--exit");
		exitBtn.addEventListener("click", () => exitPlayMode());
		toolbarEl.appendChild(exitBtn);
	}

	// ── CanvasPlugin ───────────────────────────────────────────────────────

	return {
		name: "process-runner",

		/** The toolbar element. Place this in the tabs bar center slot; shows running controls during play mode. */
		toolbar: toolbarEl,

		/** Icon button for the HUD action bar. Pass to `initEditorHud` as `playButton`. */
		playButton: playButtonEl,

		install(api: CanvasApi) {
			canvasApi = api;
			injectProcessRunnerStyles();
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
			toolbarEl.remove();
			canvasApi = null;
		},
	};
}
