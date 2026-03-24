import { useEffect, useRef, useState } from "preact/hooks"
import { useLocation } from "wouter"
import { useUiStore } from "../stores/ui.js"
import { Dialog, DialogContent } from "./ui/dialog.js"

interface CommandItem {
	id: string
	label: string
	group: string
	action: () => void
	shortcut?: string
}

interface CommandPaletteProps {
	onNavigate?: (path: string) => void
}

export function CommandPalette({ onNavigate }: CommandPaletteProps) {
	const { commandPaletteOpen, closeCommandPalette, openAI } = useUiStore()
	const [, navigate] = useLocation()
	const [query, setQuery] = useState("")
	const [selectedIdx, setSelectedIdx] = useState(0)
	const inputRef = useRef<HTMLInputElement>(null)

	const nav = onNavigate ?? navigate

	const allItems: CommandItem[] = [
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

	const filtered = query
		? allItems.filter((item) => item.label.toLowerCase().includes(query.toLowerCase()))
		: allItems

	useEffect(() => {
		if (commandPaletteOpen) {
			setQuery("")
			setSelectedIdx(0)
			setTimeout(() => inputRef.current?.focus(), 10)
		}
	}, [commandPaletteOpen])

	function handleQueryChange(newQuery: string) {
		setQuery(newQuery)
		setSelectedIdx(0)
	}

	function handleKeyDown(e: KeyboardEvent) {
		if (e.key === "ArrowDown") {
			e.preventDefault()
			setSelectedIdx((i) => Math.min(i + 1, filtered.length - 1))
		} else if (e.key === "ArrowUp") {
			e.preventDefault()
			setSelectedIdx((i) => Math.max(i - 1, 0))
		} else if (e.key === "Enter") {
			e.preventDefault()
			const item = filtered[selectedIdx]
			if (item) {
				item.action()
				closeCommandPalette()
			}
		}
	}

	const groups = Array.from(new Set(filtered.map((i) => i.group)))

	return (
		<Dialog
			open={commandPaletteOpen}
			onOpenChange={(open: boolean) => !open && closeCommandPalette()}
		>
			<DialogContent className="max-w-xl p-0 gap-0">
				<div className="border-b border-border p-3">
					<input
						ref={inputRef}
						value={query}
						onInput={(e) => handleQueryChange((e.target as HTMLInputElement).value)}
						onKeyDown={handleKeyDown}
						placeholder="Search commands..."
						className="w-full bg-transparent text-sm text-fg placeholder:text-muted outline-none"
						aria-label="Command palette search"
					/>
				</div>
				<div className="max-h-80 overflow-y-auto p-1" aria-label="Commands">
					{filtered.length === 0 && (
						<div className="px-3 py-6 text-center text-sm text-muted">No results</div>
					)}
					{groups.map((group) => {
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
											onClick={() => {
												item.action()
												closeCommandPalette()
											}}
											className={`flex w-full items-center justify-between rounded px-2 py-1.5 text-sm text-left ${
												idx === selectedIdx ? "bg-accent/10 text-fg" : "text-fg hover:bg-surface-2"
											}`}
										>
											<span>{item.label}</span>
											{item.shortcut && <kbd className="text-xs text-muted">{item.shortcut}</kbd>}
										</button>
									)
								})}
							</div>
						)
					})}
				</div>
			</DialogContent>
		</Dialog>
	)
}
