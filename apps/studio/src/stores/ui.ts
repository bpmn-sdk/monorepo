import { create } from "zustand"

const SIDEBAR_KEY = "bpmnkit-studio-sidebar-expanded"

export interface Breadcrumb {
	label: string
	href?: string
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
	commandPaletteOpen: boolean
	sidebarExpanded: boolean
	breadcrumbs: Breadcrumb[]
	contextCommands: ContextCommand[]
	paletteViewStack: PaletteView[]
	toggleAI(): void
	openAI(prompt?: string): void
	closeAI(): void
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
}

export const useUiStore = create<UiState>()((set, get) => ({
	aiOpen: false,
	aiInitialPrompt: null,
	commandPaletteOpen: false,
	sidebarExpanded: loadSidebarExpanded(),
	breadcrumbs: [],
	contextCommands: [],
	paletteViewStack: [],

	toggleAI: () => set((s) => ({ aiOpen: !s.aiOpen })),
	openAI: (prompt) => set({ aiOpen: true, aiInitialPrompt: prompt ?? null }),
	closeAI: () => set({ aiOpen: false, aiInitialPrompt: null }),

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
