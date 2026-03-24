import { create } from "zustand"

export interface ToastMessage {
	id: string
	type: "success" | "error" | "info"
	message: string
}

interface ToastState {
	toasts: ToastMessage[]
	addToast(t: Omit<ToastMessage, "id">): void
	removeToast(id: string): void
}

export const useToastStore = create<ToastState>()((set) => ({
	toasts: [],

	addToast(t) {
		const id = crypto.randomUUID()
		set((s) => ({ toasts: [...s.toasts, { ...t, id }] }))
		// Auto-remove after 5s
		setTimeout(() => {
			set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) }))
		}, 5000)
	},

	removeToast(id) {
		set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) }))
	},
}))

export const toast = {
	success: (message: string) => useToastStore.getState().addToast({ type: "success", message }),
	error: (message: string) => useToastStore.getState().addToast({ type: "error", message }),
	info: (message: string) => useToastStore.getState().addToast({ type: "info", message }),
}
