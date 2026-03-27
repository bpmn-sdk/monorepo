import { create } from "zustand"

export interface ToastMessage {
	id: string
	type: "success" | "error" | "info"
	message: string
	dying?: boolean
}

interface ToastState {
	toasts: ToastMessage[]
	addToast(t: Omit<ToastMessage, "id" | "dying">): void
	removeToast(id: string): void
}

const EXIT_MS = 220

export const useToastStore = create<ToastState>()((set) => ({
	toasts: [],

	addToast(t) {
		const id = crypto.randomUUID()
		set((s) => ({ toasts: [...s.toasts, { ...t, id }] }))
		// Start exit animation before the auto-remove deadline
		setTimeout(() => {
			set((s) => ({
				toasts: s.toasts.map((x) => (x.id === id ? { ...x, dying: true } : x)),
			}))
		}, 5000 - EXIT_MS)
		setTimeout(() => {
			set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) }))
		}, 5000)
	},

	removeToast(id) {
		set((s) => ({
			toasts: s.toasts.map((x) => (x.id === id ? { ...x, dying: true } : x)),
		}))
		setTimeout(() => {
			set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) }))
		}, EXIT_MS)
	},
}))

export const toast = {
	success: (message: string) => useToastStore.getState().addToast({ type: "success", message }),
	error: (message: string) => useToastStore.getState().addToast({ type: "error", message }),
	info: (message: string) => useToastStore.getState().addToast({ type: "info", message }),
}
