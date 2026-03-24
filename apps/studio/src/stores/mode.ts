import { create } from "zustand"

type Mode = "developer" | "operator"

const STORAGE_KEY = "bpmnkit-studio-mode"

interface ModeState {
	mode: Mode
	setMode(m: Mode): void
}

function loadMode(): Mode {
	try {
		const v = localStorage.getItem(STORAGE_KEY)
		if (v === "developer" || v === "operator") return v
	} catch {
		// storage unavailable
	}
	return "developer"
}

export const useModeStore = create<ModeState>()((set) => ({
	mode: loadMode(),

	setMode(m) {
		set({ mode: m })
		try {
			localStorage.setItem(STORAGE_KEY, m)
		} catch {
			// storage unavailable
		}
	},
}))
