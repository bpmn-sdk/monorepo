import * as DialogPrimitive from "@radix-ui/react-dialog"
import { ChevronLeft, Search } from "lucide-react"
import { useEffect, useRef, useState } from "preact/hooks"
import { useLocation } from "wouter"
import type { ContextCommand } from "../stores/ui.js"
import { useUiStore } from "../stores/ui.js"

// ── Types ─────────────────────────────────────────────────────────────────────

interface CommandItem {
	id: string
	label: string
	description?: string
	group: string
	action: () => void
	shortcut?: string
}

// ── Matching ──────────────────────────────────────────────────────────────────

/**
 * Matches when the query is a substring of the label, OR when every
 * space-separated token in the query is a prefix of some word in the label.
 * e.g. "mo" matches "Go to Models" (prefix of "Models").
 */
function matchesQuery(label: string, query: string): boolean {
	if (!query.trim()) return true
	const q = query.toLowerCase().trim()
	const l = label.toLowerCase()
	if (l.includes(q)) return true
	const tokens = q.split(/\s+/)
	const words = l.split(/[\s\-_/]+/)
	return tokens.every((t) => words.some((w) => w.startsWith(t)))
}

// ── Highlight matched substring ───────────────────────────────────────────────

function HighlightLabel({ label, query }: { label: string; query: string }) {
	const q = query.trim()
	if (!q) return <>{label}</>
	const idx = label.toLowerCase().indexOf(q.toLowerCase())
	if (idx === -1) return <>{label}</>
	return (
		<>
			{label.slice(0, idx)}
			<span className="font-semibold text-accent">{label.slice(idx, idx + q.length)}</span>
			{label.slice(idx + q.length)}
		</>
	)
}

// ── Keyboard shortcut badge ───────────────────────────────────────────────────

function ShortcutBadge({ shortcut }: { shortcut: string }) {
	const parts = shortcut.split(" ")
	return (
		<span className="flex items-center gap-0.5 shrink-0 ml-4">
			{parts.map((part, i) => (
				<kbd
					key={String(i)}
					className="inline-flex h-[18px] items-center rounded bg-surface-2 border border-border px-1.5 text-[10px] font-mono text-muted leading-none"
				>
					{part}
				</kbd>
			))}
		</span>
	)
}

// ── Footer hint ───────────────────────────────────────────────────────────────

function HintKbd({ children }: { children: string }) {
	return (
		<kbd className="inline-flex h-4 items-center rounded border border-border bg-surface-2 px-1 text-[10px] font-mono text-muted leading-none">
			{children}
		</kbd>
	)
}

// ── Main component ────────────────────────────────────────────────────────────

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
	const listRef = useRef<HTMLDivElement>(null)

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
			action: () => nav("/models"),
		},
		{
			id: "ask-ai",
			label: "Ask AI",
			group: "Actions",
			action: () => openAI(),
		},
	]

	// ── Current view ─────────────────────────────────────────────────────────

	const topView = paletteViewStack[paletteViewStack.length - 1]
	const isInView = paletteViewStack.length > 0
	const isTextInput = isInView && !!topView?.onConfirm && topView.items.length === 0

	const listItems: (CommandItem | ContextCommand)[] = isInView
		? (topView?.items ?? [])
		: [...staticItems, ...contextCommands]

	const filtered = listItems.filter((item) => matchesQuery(item.label, query))

	// ── Focus & reset ─────────────────────────────────────────────────────────

	useEffect(() => {
		if (commandPaletteOpen) {
			setQuery("")
			setSelectedIdx(0)
			setTimeout(() => inputRef.current?.focus(), 10)
		}
	}, [commandPaletteOpen])

	// biome-ignore lint/correctness/useExhaustiveDependencies: reset on view stack depth change
	useEffect(() => {
		setQuery("")
		setSelectedIdx(0)
		setTimeout(() => inputRef.current?.focus(), 10)
	}, [paletteViewStack.length])

	// Scroll selected item into view
	// biome-ignore lint/correctness/useExhaustiveDependencies: selectedIdx triggers the scroll
	useEffect(() => {
		const el = listRef.current?.querySelector('[data-selected="true"]') as HTMLElement | null
		el?.scrollIntoView({ block: "nearest" })
	}, [selectedIdx])

	// ── Execute ───────────────────────────────────────────────────────────────

	function execute(item: CommandItem | ContextCommand) {
		const stackBefore = useUiStore.getState().paletteViewStack.length
		item.action()
		const stackAfter = useUiStore.getState().paletteViewStack.length
		if (stackAfter <= stackBefore) closeCommandPalette()
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
			if (isInView) popPaletteView()
			else closeCommandPalette()
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
		<DialogPrimitive.Root
			open={commandPaletteOpen}
			onOpenChange={(open: boolean) => !open && closeCommandPalette()}
		>
			<DialogPrimitive.Portal>
				{/* Backdrop */}
				<DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />

				{/* Panel — positioned at ~16 % from top, like Raycast/Linear */}
				<DialogPrimitive.Content
					onKeyDown={handleKeyDown}
					aria-label="Command palette"
					className="fixed left-1/2 top-[16%] z-50 w-[calc(100%-2rem)] max-w-[620px] -translate-x-1/2 rounded-xl border border-border bg-surface shadow-2xl ring-1 ring-black/5 focus:outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=open]:slide-in-from-top-2"
				>
					<DialogPrimitive.Title className="sr-only">Command Palette</DialogPrimitive.Title>
					<DialogPrimitive.Description className="sr-only">
						Search and execute commands
					</DialogPrimitive.Description>

					{/* Search row */}
					<div className="flex items-center gap-3 border-b border-border px-4 py-3.5">
						{isInView ? (
							<button
								type="button"
								onClick={() => popPaletteView()}
								className="text-muted hover:text-fg shrink-0 transition-colors"
								aria-label="Back"
							>
								<ChevronLeft size={16} />
							</button>
						) : (
							<Search size={15} className="text-muted shrink-0" />
						)}
						<input
							ref={inputRef}
							value={query}
							onInput={(e) => handleQueryChange((e.target as HTMLInputElement).value)}
							onKeyDown={handleKeyDown}
							placeholder={placeholder}
							className="flex-1 bg-transparent text-sm text-fg placeholder:text-muted outline-none"
							aria-label="Command palette search"
							aria-autocomplete="list"
						/>
						<kbd className="hidden sm:inline-flex h-5 items-center rounded border border-border bg-surface-2 px-1.5 text-[10px] font-mono text-muted leading-none shrink-0">
							Esc
						</kbd>
					</div>

					{/* Command list */}
					{!isTextInput && (
						<div ref={listRef} className="max-h-[380px] overflow-y-auto p-1.5">
							{filtered.length === 0 && (
								<div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
									<Search size={18} className="text-muted/40" />
									<p className="text-sm text-muted">No results for &ldquo;{query}&rdquo;</p>
								</div>
							)}

							{isInView
								? // View-stack mode: flat list, no groups
									filtered.map((item, idx) => {
										const isSelected = idx === selectedIdx
										return (
											<button
												key={item.id}
												type="button"
												aria-selected={isSelected}
												data-selected={isSelected}
												onClick={() => execute(item)}
												onMouseEnter={() => setSelectedIdx(idx)}
												className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-left transition-colors ${
													isSelected ? "bg-accent/10 text-fg" : "text-fg hover:bg-surface-2"
												}`}
											>
												<span className="flex-1 truncate">
													<HighlightLabel label={item.label} query={query} />
												</span>
												{"description" in item && item.description && (
													<span className="text-xs text-muted shrink-0 ml-4">
														{item.description}
													</span>
												)}
											</button>
										)
									})
								: // Root mode: grouped list
									groups.map((group) => {
										const groupItems = filtered.filter((i) => i.group === group)
										return (
											<div key={group} className="mb-0.5 last:mb-0">
												<div className="px-3 pb-1 pt-2.5 text-[10px] font-semibold uppercase tracking-widest text-muted/60 select-none">
													{group}
												</div>
												{groupItems.map((item) => {
													const idx = filtered.indexOf(item)
													const isSelected = idx === selectedIdx
													return (
														<button
															key={item.id}
															type="button"
															aria-selected={isSelected}
															data-selected={isSelected}
															onClick={() => execute(item)}
															onMouseEnter={() => setSelectedIdx(idx)}
															className={`flex w-full items-center rounded-lg px-3 py-2 text-sm text-left transition-colors ${
																isSelected ? "bg-accent/10 text-fg" : "text-fg hover:bg-surface-2"
															}`}
														>
															<span className="flex-1 truncate">
																<HighlightLabel label={item.label} query={query} />
															</span>
															{"shortcut" in item && item.shortcut ? (
																<ShortcutBadge shortcut={item.shortcut} />
															) : "description" in item && item.description ? (
																<span className="text-xs text-muted shrink-0 ml-4">
																	{item.description}
																</span>
															) : null}
														</button>
													)
												})}
											</div>
										)
									})}
						</div>
					)}

					{/* Text-input mode hint */}
					{isTextInput && (
						<div className="flex items-center gap-1.5 px-4 py-3 text-xs text-muted">
							Press
							<kbd className="inline-flex h-[18px] items-center rounded border border-border bg-surface-2 px-1.5 text-[10px] font-mono leading-none">
								↵
							</kbd>
							to confirm,
							<kbd className="inline-flex h-[18px] items-center rounded border border-border bg-surface-2 px-1.5 text-[10px] font-mono leading-none">
								Esc
							</kbd>
							to go back
						</div>
					)}

					{/* Footer — keyboard hints */}
					{!isTextInput && filtered.length > 0 && (
						<div className="flex items-center gap-3 border-t border-border px-4 py-2 text-[11px] text-muted select-none">
							<span className="flex items-center gap-1">
								<HintKbd>↑</HintKbd>
								<HintKbd>↓</HintKbd>
								Navigate
							</span>
							<span className="flex items-center gap-1">
								<HintKbd>↵</HintKbd>
								Select
							</span>
							{isInView && (
								<span className="flex items-center gap-1">
									<HintKbd>Esc</HintKbd>
									Back
								</span>
							)}
						</div>
					)}
				</DialogPrimitive.Content>
			</DialogPrimitive.Portal>
		</DialogPrimitive.Root>
	)
}
