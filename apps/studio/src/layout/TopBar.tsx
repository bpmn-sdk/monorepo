import { MessageSquare } from "lucide-react"
import { ClusterPicker } from "../components/ClusterPicker.js"
import { ModeToggle } from "../components/ModeToggle.js"
import { ThemePicker } from "../components/ThemePicker.js"
import { useUiStore } from "../stores/ui.js"

export function TopBar() {
	const { aiOpen, toggleAI, openCommandPalette } = useUiStore()

	return (
		<header className="flex h-12 shrink-0 items-center gap-3 border-b border-border bg-surface px-3">
			{/* Logo */}
			<div className="flex items-center gap-1.5 text-sm font-semibold text-fg">
				<span className="text-accent" aria-hidden="true">
					◈
				</span>
				<span>Studio</span>
			</div>

			{/* Cluster picker */}
			<ClusterPicker />

			{/* Search trigger */}
			<button
				type="button"
				onClick={openCommandPalette}
				className="flex flex-1 items-center gap-2 rounded border border-border bg-surface-2 px-3 py-1 text-sm text-muted hover:text-fg max-w-sm"
				aria-label="Open command palette"
			>
				<span className="flex-1 text-left">Search...</span>
				<kbd className="text-xs">⌘K</kbd>
			</button>

			<div className="ml-auto flex items-center gap-2">
				<ModeToggle />
				<ThemePicker />
				<button
					type="button"
					onClick={toggleAI}
					className={`flex h-8 w-8 items-center justify-center rounded border transition-colors ${
						aiOpen
							? "border-accent bg-accent/10 text-accent"
							: "border-border text-muted hover:text-fg"
					}`}
					aria-label="Toggle AI assistant"
					aria-pressed={aiOpen}
				>
					<MessageSquare size={16} />
				</button>
			</div>
		</header>
	)
}
