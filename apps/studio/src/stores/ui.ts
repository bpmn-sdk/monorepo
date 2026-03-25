import { create } from "zustand"

const SIDEBAR_KEY = "bpmnkit-studio-sidebar-expanded"

export interface Breadcrumb {
	label: string
	href?: string
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
	commandPaletteOpen: boolean
	sidebarExpanded: boolean
	breadcrumbs: Breadcrumb[]
	toggleAI(): void
	openAI(): void
	closeAI(): void
	toggleCommandPalette(): void
	openCommandPalette(): void
	closeCommandPalette(): void
	toggleSidebar(): void
	setSidebarExpanded(v: boolean): void
	setBreadcrumbs(crumbs: Breadcrumb[]): void
}

export const useUiStore = create<UiState>()((set) => ({
	aiOpen: false,
	commandPaletteOpen: false,
	sidebarExpanded: loadSidebarExpanded(),
	breadcrumbs: [],

	toggleAI: () => set((s) => ({ aiOpen: !s.aiOpen })),
	openAI: () => set({ aiOpen: true }),
	closeAI: () => set({ aiOpen: false }),
	toggleCommandPalette: () => set((s) => ({ commandPaletteOpen: !s.commandPaletteOpen })),
	openCommandPalette: () => set({ commandPaletteOpen: true }),
	closeCommandPalette: () => set({ commandPaletteOpen: false }),

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
}))
