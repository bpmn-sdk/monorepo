import type { ComponentChildren } from "preact"
import { useEffect } from "preact/hooks"
import { useLocation } from "wouter"
import { CommandPalette } from "../components/CommandPalette.js"
import { ToastContainer } from "../components/Toast.js"
import { useUiStore } from "../stores/ui.js"
import { AIDrawer } from "./AIDrawer.js"
import { Sidebar } from "./Sidebar.js"
import { TopBar } from "./TopBar.js"

interface ShellProps {
	children: ComponentChildren
}

const ROUTE_MAP: Record<string, string> = {
	d: "/",
	m: "/models",
	e: "/definitions",
	i: "/instances",
	n: "/incidents",
	t: "/tasks",
	c: "/decisions",
	s: "/settings",
}

export function Shell({ children }: ShellProps) {
	const [, navigate] = useLocation()
	const { toggleCommandPalette, toggleAI, toggleSidebar, zenMode } = useUiStore()

	// Global keyboard shortcuts
	useEffect(() => {
		let gPressed = false
		let gTimer: ReturnType<typeof setTimeout> | null = null

		function handleKeyDown(e: KeyboardEvent) {
			const target = e.target as HTMLElement
			const isInput =
				target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable

			// ⌘K — command palette
			if ((e.metaKey || e.ctrlKey) && e.key === "k") {
				e.preventDefault()
				toggleCommandPalette()
				return
			}

			// ⌘J — AI drawer
			if ((e.metaKey || e.ctrlKey) && e.key === "j") {
				e.preventDefault()
				toggleAI()
				return
			}

			if (isInput) return

			// [ — toggle sidebar
			if (e.key === "[" && !e.metaKey && !e.ctrlKey) {
				toggleSidebar()
				return
			}

			// g + letter navigation
			if (e.key === "g" && !e.metaKey && !e.ctrlKey) {
				gPressed = true
				if (gTimer) clearTimeout(gTimer)
				gTimer = setTimeout(() => {
					gPressed = false
				}, 1000)
				return
			}

			if (gPressed && ROUTE_MAP[e.key]) {
				e.preventDefault()
				gPressed = false
				if (gTimer) clearTimeout(gTimer)
				const path = ROUTE_MAP[e.key]
				if (path) navigate(path)
			}
		}

		window.addEventListener("keydown", handleKeyDown)
		return () => window.removeEventListener("keydown", handleKeyDown)
	}, [navigate, toggleCommandPalette, toggleAI, toggleSidebar])

	return (
		<div className="flex h-full flex-col overflow-hidden">
			{!zenMode && <TopBar />}
			<div className="flex flex-1 overflow-hidden">
				{!zenMode && <Sidebar />}
				<main className="flex-1 overflow-y-auto bg-bg">{children}</main>
				{!zenMode && <AIDrawer />}
			</div>
			<ToastContainer />
			<CommandPalette />
		</div>
	)
}
