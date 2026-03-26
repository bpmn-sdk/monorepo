import { ChevronLeft } from "lucide-react"
import { useEffect, useRef, useState } from "preact/hooks"
import { useLocation } from "wouter"
import type { ContextCommand } from "../stores/ui.js"
import { useUiStore } from "../stores/ui.js"
import { Dialog, DialogContent } from "./ui/dialog.js"

interface CommandItem {
	id: string
	label: string
	description?: string
	group: string
	action: () => void
	shortcut?: string
}

interface CommandPaletteProps {
	onNavigate?: (path: string) => void
}

export function CommandPalette({ onNavigate }: CommandPaletteProps) {
	const {
		commandPaletteOpen,
		closeCommandPalette,
		openAI,
		contextCommands,
		paletteViewStack,
		popPaletteView,
	} = useUiStore()
	const [, navigate] = useLocation()
	const [query, setQuery] = useState("")
	const [selectedIdx, setSelectedIdx] = useState(0)
	const inputRef = useRef<HTMLInputElement>(null)

	const nav = onNavigate ?? navigate

	const staticItems: CommandItem[] = [
		{ id: "dash", label: "Go to Dashboard", group: "Navigation", action: () => nav("/") },
		{
			id: "models",
			label: "Go to Models",
			group: "Navigation",
			action: () => nav("/models"),
			shortcut: "g m",
		},
		{
			id: "defs",
			label: "Go to Definitions",
			group: "Navigation",
			action: () => nav("/definitions"),
			shortcut: "g e",
		},
		{
			id: "insts",
			label: "Go to Instances",
			group: "Navigation",
			action: () => nav("/instances"),
			shortcut: "g i",
		},
		{
			id: "incidents",
			label: "Go to Incidents",
			group: "Navigation",
			action: () => nav("/incidents"),
			shortcut: "g n",
		},
		{
			id: "tasks",
			label: "Go to Tasks",
			group: "Navigation",
			action: () => nav("/tasks"),
			shortcut: "g t",
		},
		{
			id: "decisions",
			label: "Go to Decisions",
			group: "Navigation",
			action: () => nav("/decisions"),
			shortcut: "g c",
		},
		{
			id: "settings",
			label: "Go to Settings",
			group: "Navigation",
			action: () => nav("/settings"),
			shortcut: "g s",
		},
		{
			id: "new-model",
			label: "New Model",
			group: "Actions",
			action: () => {
				nav("/models")
			},
		},
		{
			id: "ask-ai",
			label: "Ask AI",
			group: "Actions",
			action: () => {
				openAI()
			},
		},
	]

	// ── Current view ─────────────────────────────────────────────────────────

	const topView = paletteViewStack[paletteViewStack.length - 1]
	const isInView = paletteViewStack.length > 0
	// Text-input mode: the view has onConfirm but no items to pick from
	const isTextInput = isInView && !!topView?.onConfirm && topView.items.length === 0

	// Items shown in list mode
	const listItems: (CommandItem | ContextCommand)[] = isInView
		? (topView?.items ?? [])
		: [...staticItems, ...contextCommands]

	const filtered = query
		? listItems.filter((item) => item.label.toLowerCase().includes(query.toLowerCase()))
		: listItems

	// ── Focus & reset ─────────────────────────────────────────────────────────

	useEffect(() => {
		if (commandPaletteOpen) {
			setQuery("")
			setSelectedIdx(0)
			setTimeout(() => inputRef.current?.focus(), 10)
		}
	}, [commandPaletteOpen])

	// Reset query when view changes
	// biome-ignore lint/correctness/useExhaustiveDependencies: reset on view stack depth change
	useEffect(() => {
		setQuery("")
		setSelectedIdx(0)
		setTimeout(() => inputRef.current?.focus(), 10)
	}, [paletteViewStack.length])

	// ── Execute ───────────────────────────────────────────────────────────────

	/**
	 * Run an item's action. If the action pushes a palette view (stack grows),
	 * keep the palette open. Otherwise close it.
	 */
	function execute(item: CommandItem | ContextCommand) {
		const stackBefore = useUiStore.getState().paletteViewStack.length
		item.action()
		const stackAfter = useUiStore.getState().paletteViewStack.length
		if (stackAfter <= stackBefore) {
			closeCommandPalette()
		}
	}

	function handleConfirm(value: string) {
		if (!topView?.onConfirm) return
		topView.onConfirm(value)
		closeCommandPalette()
	}

	// ── Keyboard ──────────────────────────────────────────────────────────────

	function handleQueryChange(newQuery: string) {
		setQuery(newQuery)
		setSelectedIdx(0)
	}

	function handleKeyDown(e: KeyboardEvent) {
		if (e.key === "Escape") {
			e.preventDefault()
			if (isInView) {
				popPaletteView()
			} else {
				closeCommandPalette()
			}
			return
		}

		if (isTextInput) {
			if (e.key === "Enter") {
				e.preventDefault()
				handleConfirm(query)
			}
			return
		}

		if (e.key === "ArrowDown") {
			e.preventDefault()
			setSelectedIdx((i) => Math.min(i + 1, filtered.length - 1))
		} else if (e.key === "ArrowUp") {
			e.preventDefault()
			setSelectedIdx((i) => Math.max(i - 1, 0))
		} else if (e.key === "Enter") {
			e.preventDefault()
			const item = filtered[selectedIdx]
			if (item) execute(item)
		}
	}

	// ── Render ────────────────────────────────────────────────────────────────

	const groups = isInView ? [] : Array.from(new Set(filtered.map((i) => i.group)))

	const placeholder = isInView ? (topView?.placeholder ?? "Search…") : "Search commands…"

	return (
		<Dialog
			open={commandPaletteOpen}
			onOpenChange={(open: boolean) => !open && closeCommandPalette()}
		>
			<DialogContent className="max-w-xl p-0 gap-0">
				{/* Search / text-input row */}
				<div className="border-b border-border p-3 flex items-center gap-2">
					{isInView && (
						<button
							type="button"
							onClick={() => popPaletteView()}
							className="text-muted hover:text-fg shrink-0"
							aria-label="Back"
						>
							<ChevronLeft size={16} />
						</button>
					)}
					<input
						ref={inputRef}
						value={query}
						onInput={(e) => handleQueryChange((e.target as HTMLInputElement).value)}
						onKeyDown={handleKeyDown}
						placeholder={placeholder}
						className="flex-1 bg-transparent text-sm text-fg placeholder:text-muted outline-none"
						aria-label="Command palette search"
					/>
				</div>

				{/* List or hint */}
				{!isTextInput && (
					<div className="max-h-80 overflow-y-auto p-1" aria-label="Commands">
						{filtered.length === 0 && (
							<div className="px-3 py-6 text-center text-sm text-muted">No results</div>
						)}

						{isInView
							? // View-stack mode: flat list, no groups
								filtered.map((item, idx) => (
									<button
										key={item.id}
										type="button"
										aria-selected={idx === selectedIdx}
										onClick={() => execute(item)}
										className={`flex w-full items-center justify-between rounded px-2 py-1.5 text-sm text-left ${
											idx === selectedIdx ? "bg-accent/10 text-fg" : "text-fg hover:bg-surface-2"
										}`}
									>
										<span>{item.label}</span>
										{"description" in item && item.description && (
											<span className="text-xs text-muted ml-2 shrink-0">{item.description}</span>
										)}
									</button>
								))
							: // Root mode: grouped list
								groups.map((group) => {
									const items = filtered.filter((i) => i.group === group)
									return (
										<div key={group}>
											<div className="px-2 py-1.5 text-xs font-medium text-muted">{group}</div>
											{items.map((item) => {
												const idx = filtered.indexOf(item)
												return (
													<button
														key={item.id}
														type="button"
														aria-selected={idx === selectedIdx}
														onClick={() => execute(item)}
														className={`flex w-full items-center justify-between rounded px-2 py-1.5 text-sm text-left ${
															idx === selectedIdx
																? "bg-accent/10 text-fg"
																: "text-fg hover:bg-surface-2"
														}`}
													>
														<span>{item.label}</span>
														<span className="text-xs text-muted ml-2 shrink-0">
															{"shortcut" in item && item.shortcut
																? item.shortcut
																: "description" in item && item.description
																	? item.description
																	: null}
														</span>
													</button>
												)
											})}
										</div>
									)
								})}
					</div>
				)}

				{isTextInput && (
					<div className="px-4 py-3 text-xs text-muted">
						Press Enter to confirm, Escape to go back
					</div>
				)}
			</DialogContent>
		</Dialog>
	)
}
