import { flushSync } from "preact/compat"

/**
 * Navigate to `path` inside a View Transition when the browser supports it.
 * `flushSync` forces Preact to flush the state update synchronously inside
 * the transition callback so the browser can diff the before/after snapshots.
 */
export function navigateWithTransition(path: string, navigate: (path: string) => void): void {
	if (!document.startViewTransition) {
		navigate(path)
		return
	}
	document.startViewTransition(() => {
		flushSync(() => navigate(path))
	})
}
