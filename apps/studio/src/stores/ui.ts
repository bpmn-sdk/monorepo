import { create } from "zustand"

interface UiState {
	aiOpen: boolean
	commandPaletteOpen: boolean
	toggleAI(): void
	openAI(): void
	closeAI(): void
	toggleCommandPalette(): void
	openCommandPalette(): void
	closeCommandPalette(): void
}

export const useUiStore = create<UiState>()((set) => ({
	aiOpen: false,
	commandPaletteOpen: false,

	toggleAI: () => set((s) => ({ aiOpen: !s.aiOpen })),
	openAI: () => set({ aiOpen: true }),
	closeAI: () => set({ aiOpen: false }),
	toggleCommandPalette: () => set((s) => ({ commandPaletteOpen: !s.commandPaletteOpen })),
	openCommandPalette: () => set({ commandPaletteOpen: true }),
	closeCommandPalette: () => set({ commandPaletteOpen: false }),
}))
