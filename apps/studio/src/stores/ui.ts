import type { BpmnDefinitions } from "@bpmnkit/core"
import { create } from "zustand"

const SIDEBAR_KEY = "bpmnkit-studio-sidebar-expanded"

export interface Breadcrumb {
	label: string
	href?: string
}

export interface AiMessage {
	id: string
	role: "user" | "assistant"
	content: string
	/** BPMN XML returned by AI in editor context — rendered as canvas preview */
	xml?: string
}

export type AiBackend = "auto" | "claude" | "copilot" | "gemini"

export interface EditorAiContext {
	getDefinitions(): BpmnDefinitions | null
	loadXml(xml: string): void
	getTheme?(): "dark" | "light"
	createCompanionFile?(name: string, type: "dmn" | "form", content: string): Promise<void>
}

export interface ContextCommand {
	id: string
	label: string
	description?: string
	group: string
	action: () => void
}

export interface PaletteView {
	items: ContextCommand[]
	placeholder?: string
	onConfirm?: (value: string) => void
}

function loadSidebarExpanded(): boolean {
	try {
		const v = localStorage.getItem(SIDEBAR_KEY)
		if (v === "false") return false
	} catch {
		// storage unavailable
	}
	return true
}

interface UiState {
	aiOpen: boolean
	aiInitialPrompt: string | null
	aiInitialMessages: AiMessage[] | null
	editorAiContext: EditorAiContext | null
	/** Shared persistent chat history (text-chat mode) */
	aiMessages: AiMessage[]
	/** Currently selected AI backend */
	aiBackend: AiBackend
	/** Backends reported available by the proxy /status endpoint */
	aiAvailableBackends: string[]
	commandPaletteOpen: boolean
	sidebarExpanded: boolean
	zenMode: boolean
	showWelcomeModal: boolean
	breadcrumbs: Breadcrumb[]
	contextCommands: ContextCommand[]
	paletteViewStack: PaletteView[]
	toggleAI(): void
	openAI(prompt?: string, messages?: AiMessage[]): void
	closeAI(): void
	setEditorAiContext(ctx: EditorAiContext | null): void
	pushAiMessage(msg: AiMessage): void
	updateAiMessage(id: string, patch: Partial<Pick<AiMessage, "content" | "xml">>): void
	clearAiMessages(): void
	setAiBackend(b: AiBackend): void
	setAiAvailableBackends(backends: string[]): void
	toggleCommandPalette(): void
	openCommandPalette(): void
	closeCommandPalette(): void
	toggleSidebar(): void
	setSidebarExpanded(v: boolean): void
	setBreadcrumbs(crumbs: Breadcrumb[]): void
	/** Append context commands. Returns a deregister function. */
	addContextCommands(cmds: ContextCommand[]): () => void
	clearContextCommands(): void
	pushPaletteView(view: PaletteView): void
	popPaletteView(): void
	enterZenMode(): void
	exitZenMode(): void
	openWelcomeModal(): void
	closeWelcomeModal(): void
}

export const useUiStore = create<UiState>()((set, get) => ({
	aiOpen: false,
	aiInitialPrompt: null,
	aiInitialMessages: null,
	editorAiContext: null,
	aiMessages: [],
	aiBackend: "auto",
	aiAvailableBackends: [],
	commandPaletteOpen: false,
	sidebarExpanded: loadSidebarExpanded(),
	zenMode: false,
	showWelcomeModal: false,
	breadcrumbs: [],
	contextCommands: [],
	paletteViewStack: [],

	toggleAI: () => set((s) => ({ aiOpen: !s.aiOpen })),
	openAI: (prompt, messages) =>
		set({ aiOpen: true, aiInitialPrompt: prompt ?? null, aiInitialMessages: messages ?? null }),
	closeAI: () => set({ aiOpen: false, aiInitialPrompt: null, aiInitialMessages: null }),
	setEditorAiContext: (ctx) => set({ editorAiContext: ctx }),

	pushAiMessage: (msg) => set((s) => ({ aiMessages: [...s.aiMessages, msg] })),
	updateAiMessage: (id, patch) =>
		set((s) => ({
			aiMessages: s.aiMessages.map((m) => (m.id === id ? { ...m, ...patch } : m)),
		})),
	clearAiMessages: () => set({ aiMessages: [] }),
	setAiBackend: (b) => set({ aiBackend: b }),
	setAiAvailableBackends: (backends) => set({ aiAvailableBackends: backends }),

	toggleCommandPalette: () =>
		set((s) => ({
			commandPaletteOpen: !s.commandPaletteOpen,
			paletteViewStack: s.commandPaletteOpen ? [] : s.paletteViewStack,
		})),
	openCommandPalette: () => set({ commandPaletteOpen: true }),
	closeCommandPalette: () => set({ commandPaletteOpen: false, paletteViewStack: [] }),

	toggleSidebar: () =>
		set((s) => {
			const next = !s.sidebarExpanded
			try {
				localStorage.setItem(SIDEBAR_KEY, String(next))
			} catch {
				// storage unavailable
			}
			return { sidebarExpanded: next }
		}),

	setSidebarExpanded: (v) => {
		try {
			localStorage.setItem(SIDEBAR_KEY, String(v))
		} catch {
			// storage unavailable
		}
		set({ sidebarExpanded: v })
	},

	setBreadcrumbs: (crumbs) => set({ breadcrumbs: crumbs }),

	addContextCommands: (cmds) => {
		set((s) => ({ contextCommands: [...s.contextCommands, ...cmds] }))
		return () => {
			const ids = new Set(cmds.map((c) => c.id))
			set((s) => ({ contextCommands: s.contextCommands.filter((c) => !ids.has(c.id)) }))
		}
	},

	clearContextCommands: () => set({ contextCommands: [], paletteViewStack: [] }),

	enterZenMode: () => set({ zenMode: true }),
	exitZenMode: () => set({ zenMode: false }),

	openWelcomeModal: () => set({ showWelcomeModal: true }),
	closeWelcomeModal: () => set({ showWelcomeModal: false }),

	pushPaletteView: (view) =>
		set((s) => ({ paletteViewStack: [...s.paletteViewStack, view], commandPaletteOpen: true })),

	popPaletteView: () => {
		const { paletteViewStack } = get()
		if (paletteViewStack.length <= 1) {
			set({ paletteViewStack: [] })
		} else {
			set({ paletteViewStack: paletteViewStack.slice(0, -1) })
		}
	},
}))
