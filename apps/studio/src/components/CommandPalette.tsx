import { BpmnCanvas } from "@bpmnkit/canvas"
import { compactify } from "@bpmnkit/core"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { ArrowUpRight, ChevronLeft, Search, Sparkles } from "lucide-react"
import { useEffect, useRef, useState } from "preact/hooks"
import { useLocation } from "wouter"
import { getProxyUrl } from "../api/client.js"
import { navigateWithTransition } from "../lib/transition.js"
import { useThemeStore } from "../stores/theme.js"
import type { AiBackend, AiMessage, ContextCommand } from "../stores/ui.js"
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

// ── Thinking indicator ────────────────────────────────────────────────────────

function ThinkingDots() {
	return (
		<div className="flex items-center gap-1 py-1">
			<span className="h-2 w-2 rounded-full bg-accent animate-bounce [animation-delay:-0.3s]" />
			<span className="h-2 w-2 rounded-full bg-accent animate-bounce [animation-delay:-0.15s]" />
			<span className="h-2 w-2 rounded-full bg-accent animate-bounce" />
		</div>
	)
}

// ── Backend selector ──────────────────────────────────────────────────────────

function BackendSelector() {
	const { aiBackend, aiAvailableBackends, setAiBackend } = useUiStore()

	useEffect(() => {
		const { setAiAvailableBackends } = useUiStore.getState()
		fetch(`${getProxyUrl()}/status`)
			.then((r) => r.json())
			.then((d: { available?: string[] }) => {
				if (Array.isArray(d.available)) setAiAvailableBackends(d.available)
			})
			.catch(() => {})
	}, [])

	const displayName =
		aiBackend === "auto"
			? aiAvailableBackends[0]
				? capitalize(aiAvailableBackends[0])
				: "Auto"
			: capitalize(aiBackend)

	return (
		<div className="relative inline-flex items-center">
			<select
				value={aiBackend}
				onChange={(e) => setAiBackend((e.target as HTMLSelectElement).value as AiBackend)}
				className="appearance-none bg-surface-2 border border-border rounded px-2 py-0.5 text-[11px] text-muted hover:text-fg cursor-pointer focus:outline-none focus:ring-1 focus:ring-accent pr-5"
				aria-label="Select AI backend"
			>
				<option value="auto">
					Auto ({aiAvailableBackends[0] ? capitalize(aiAvailableBackends[0]) : "?"})
				</option>
				{aiAvailableBackends.map((b) => (
					<option key={b} value={b}>
						{capitalize(b)}
					</option>
				))}
			</select>
			<span className="pointer-events-none absolute right-1.5 text-[9px] text-muted">▾</span>
		</div>
	)
}

function capitalize(s: string): string {
	return s.charAt(0).toUpperCase() + s.slice(1)
}

// ── BPMN XML Preview ──────────────────────────────────────────────────────────

function XmlPreview({ xml }: { xml: string }) {
	const containerRef = useRef<HTMLDivElement>(null)
	const { theme } = useThemeStore()

	useEffect(() => {
		const container = containerRef.current
		if (!container) return
		const canvas = new BpmnCanvas({
			container,
			theme: theme === "light" ? "light" : "dark",
			grid: false,
			fit: "contain",
		})
		void canvas.load(xml)
		return () => canvas.destroy()
	}, [xml, theme])

	return (
		<div
			ref={containerRef}
			className="mt-2 rounded border border-border overflow-hidden"
			style={{ height: 160 }}
		/>
	)
}

// ── Inline AI Chat ────────────────────────────────────────────────────────────

interface InlineAiChatProps {
	initialQuery: string
	onOpenInSidebar(): void
	onBack(): void
}

function InlineAiChat({ initialQuery, onOpenInSidebar, onBack }: InlineAiChatProps) {
	const { editorAiContext, aiMessages, aiBackend, pushAiMessage, updateAiMessage } = useUiStore()
	const [input, setInput] = useState("")
	const [loading, setLoading] = useState(false)
	const messagesEndRef = useRef<HTMLDivElement>(null)
	const inputRef = useRef<HTMLTextAreaElement>(null)

	// biome-ignore lint/correctness/useExhaustiveDependencies: send once on mount with initial query
	useEffect(() => {
		void sendMessage(initialQuery)
	}, [])

	const messageCount = aiMessages.length
	// biome-ignore lint/correctness/useExhaustiveDependencies: scroll on count change
	useEffect(() => {
		messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
	}, [messageCount])

	async function sendMessage(text?: string) {
		const msgText = (text ?? input).trim()
		if (!msgText || loading) return

		const userMsg: AiMessage = { id: crypto.randomUUID(), role: "user", content: msgText }
		// Use store snapshot for building the history payload (before adding new messages)
		const historyPayload = useUiStore.getState().aiMessages
		pushAiMessage(userMsg)
		if (!text) setInput("")
		setLoading(true)

		const assistantId = crypto.randomUUID()
		pushAiMessage({ id: assistantId, role: "assistant", content: "" })

		const backendParam = aiBackend === "auto" ? null : aiBackend

		try {
			let url: string
			let body: unknown

			if (editorAiContext) {
				const defs = editorAiContext.getDefinitions()
				const context = defs ? compactify(defs) : null
				url = `${getProxyUrl()}/chat`
				body = {
					messages: [...historyPayload, userMsg].map((m) => ({
						role: m.role === "assistant" ? "ai" : m.role,
						content: m.content,
					})),
					context,
					backend: backendParam,
				}
			} else {
				url = `${getProxyUrl()}/operate/chat`
				body = {
					messages: [...historyPayload, userMsg].map((m) => ({
						role: m.role,
						content: m.content,
					})),
					backend: backendParam,
				}
			}

			const response = await fetch(url, {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify(body),
			})

			if (!response.ok || !response.body) throw new Error(`HTTP ${response.status}`)

			const reader = response.body.getReader()
			const decoder = new TextDecoder()
			let accumulated = ""
			let xmlReceived: string | null = null

			while (true) {
				const { done, value } = await reader.read()
				if (done) break
				const chunk = decoder.decode(value, { stream: true })
				for (const line of chunk.split("\n")) {
					if (!line.startsWith("data: ")) continue
					try {
						const parsed = JSON.parse(line.slice(6)) as
							| { type: "token"; text: string }
							| { type: "xml"; xml: string }
							| { type: "done" }
							| { type: "error"; message: string }
						if (parsed.type === "done") break
						if (parsed.type === "error") throw new Error(parsed.message)
						if (parsed.type === "xml") xmlReceived = parsed.xml
						if (parsed.type === "token") {
							accumulated += parsed.text
							updateAiMessage(assistantId, { content: accumulated })
						}
					} catch (e) {
						if (e instanceof SyntaxError) continue
						throw e
					}
				}
			}

			if (xmlReceived) updateAiMessage(assistantId, { xml: xmlReceived })
		} catch (err) {
			updateAiMessage(assistantId, {
				content: `Error: ${err instanceof Error ? err.message : String(err)}`,
			})
		} finally {
			setLoading(false)
			setTimeout(() => inputRef.current?.focus(), 50)
		}
	}

	function handleKeyDown(e: KeyboardEvent) {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault()
			void sendMessage()
		}
		if (e.key === "Escape") {
			e.preventDefault()
			onBack()
		}
	}

	// Find the last message with xml to show apply button
	const lastXmlMsg = [...aiMessages].reverse().find((m) => m.xml)

	return (
		<div className="flex flex-col" style={{ maxHeight: 520 }}>
			{/* Chat header */}
			<div className="flex items-center gap-2 border-b border-border px-3 py-2.5">
				<button
					type="button"
					onClick={onBack}
					className="text-muted hover:text-fg shrink-0 transition-colors"
					aria-label="Back to commands"
				>
					<ChevronLeft size={16} />
				</button>
				<Sparkles size={13} className="text-accent shrink-0" />
				<span className="text-sm font-medium text-fg flex-1">AI Chat</span>
				<BackendSelector />
				<button
					type="button"
					onClick={onOpenInSidebar}
					className="flex items-center gap-1 text-xs text-muted hover:text-fg transition-colors shrink-0 ml-1"
					title="Continue in sidebar"
				>
					<ArrowUpRight size={13} />
					Sidebar
				</button>
			</div>

			{/* Messages */}
			<div className="overflow-y-auto p-3 space-y-2.5 min-h-0" style={{ maxHeight: 340 }}>
				{aiMessages.length === 0 && (
					<p className="text-center text-xs text-muted py-6">Ask anything…</p>
				)}
				{aiMessages.map((msg) => (
					<div
						key={msg.id}
						className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}
					>
						<div
							className={`max-w-[88%] rounded-lg px-3 py-2 text-sm ${
								msg.role === "user" ? "bg-accent text-accent-fg" : "bg-surface-2 text-fg"
							}`}
						>
							{msg.content && msg.content}
							{!msg.content && loading && msg.role === "assistant" && <ThinkingDots />}
						</div>
						{/* BPMN preview inline */}
						{msg.xml && editorAiContext && (
							<div className="w-full max-w-full mt-1">
								<XmlPreview xml={msg.xml} />
								<div className="flex items-center justify-between mt-1 px-1">
									<span className="text-[11px] text-muted">Diagram ready</span>
									<button
										type="button"
										onClick={() => msg.xml && editorAiContext.loadXml(msg.xml)}
										className="text-[11px] font-medium text-accent hover:underline"
									>
										Apply to editor
									</button>
								</div>
							</div>
						)}
					</div>
				))}
				{/* Apply button for last xml if not already shown (non-editor context shouldn't happen but safe) */}
				{lastXmlMsg?.xml && !editorAiContext && (
					<div className="flex items-center gap-2 rounded-lg border border-accent/30 bg-accent/5 px-3 py-2 text-sm">
						<Sparkles size={13} className="text-accent shrink-0" />
						<span className="text-fg flex-1 text-xs">Diagram ready</span>
					</div>
				)}
				<div ref={messagesEndRef} />
			</div>

			{/* Input */}
			<div className="border-t border-border px-3 py-2.5">
				<textarea
					ref={inputRef}
					value={input}
					onInput={(e) => setInput((e.target as HTMLTextAreaElement).value)}
					onKeyDown={handleKeyDown}
					placeholder="Follow up… (Enter to send)"
					className="w-full resize-none rounded border border-border bg-surface-2 px-2.5 py-1.5 text-sm text-fg placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-accent"
					rows={2}
					disabled={loading}
				/>
				<div className="mt-1 flex items-center justify-between">
					<span className="text-[11px] text-muted">Shift+Enter for newline · Esc to go back</span>
					{loading && <span className="text-[11px] text-accent animate-pulse">Thinking…</span>}
				</div>
			</div>
		</div>
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
		aiMessages,
	} = useUiStore()
	const [, navigate] = useLocation()
	const [query, setQuery] = useState("")
	const [selectedIdx, setSelectedIdx] = useState(0)
	const [chatMode, setChatMode] = useState(false)
	const [chatQuery, setChatQuery] = useState("")
	const inputRef = useRef<HTMLInputElement>(null)
	const listRef = useRef<HTMLDivElement>(null)

	const nav = onNavigate ?? ((path: string) => navigateWithTransition(path, navigate))

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

	// "/" prefix = command-only mode: strip navigation items
	const isCommandMode = !isInView && query.startsWith("/")
	const effectiveQuery = isCommandMode ? query.slice(1) : query

	const listItems: (CommandItem | ContextCommand)[] = isInView
		? (topView?.items ?? [])
		: isCommandMode
			? [...staticItems.filter((i) => i.group !== "Navigation"), ...contextCommands]
			: [...staticItems, ...contextCommands]

	const filtered = listItems.filter((item) => matchesQuery(item.label, effectiveQuery))

	const trimmedQuery = effectiveQuery.trim()
	// Show Ask AI row in root mode when not in command mode and user has typed something or has history
	const showAskAi =
		!isInView && !isCommandMode && (trimmedQuery.length > 0 || aiMessages.length > 0)

	const totalItems = filtered.length + (showAskAi ? 1 : 0)
	const askAiIdx = filtered.length

	function executeAskAi() {
		// If there's already chat history and no new query, just open chat mode
		setChatQuery(trimmedQuery)
		setChatMode(true)
	}

	function handleOpenInSidebar() {
		openAI()
		closeCommandPalette()
	}

	function handleChatBack() {
		setChatMode(false)
	}

	// ── Focus & reset ─────────────────────────────────────────────────────────

	useEffect(() => {
		if (commandPaletteOpen) {
			setQuery("")
			setSelectedIdx(0)
			setTimeout(() => inputRef.current?.focus(), 10)
		} else {
			// Reset chat mode on close so re-opening doesn't re-send the initial query
			setChatMode(false)
		}
	}, [commandPaletteOpen])

	// biome-ignore lint/correctness/useExhaustiveDependencies: reset on view stack depth change
	useEffect(() => {
		setQuery("")
		setSelectedIdx(0)
		setTimeout(() => inputRef.current?.focus(), 10)
	}, [paletteViewStack.length])

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
			setSelectedIdx((i) => Math.min(i + 1, totalItems - 1))
		} else if (e.key === "ArrowUp") {
			e.preventDefault()
			setSelectedIdx((i) => Math.max(i - 1, 0))
		} else if (e.key === "Enter") {
			e.preventDefault()
			if (showAskAi && selectedIdx === askAiIdx) {
				executeAskAi()
			} else {
				const item = filtered[selectedIdx]
				if (item) execute(item)
			}
		}
	}

	// ── Render ────────────────────────────────────────────────────────────────

	const groups = isInView ? [] : Array.from(new Set(filtered.map((i) => i.group)))
	const placeholder = isInView
		? (topView?.placeholder ?? "Search…")
		: isCommandMode
			? "Filter commands…"
			: "Search or type / for commands…"

	return (
		<DialogPrimitive.Root
			open={commandPaletteOpen}
			onOpenChange={(open: boolean) => !open && closeCommandPalette()}
		>
			<DialogPrimitive.Portal>
				{/* Backdrop — above everything including the editor dock (z-9999) */}
				<DialogPrimitive.Overlay className="fixed inset-0 z-[10000] bg-black/50 backdrop-blur-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 duration-200" />

				{/* Panel */}
				<DialogPrimitive.Content
					onKeyDown={chatMode ? undefined : handleKeyDown}
					aria-label="Command palette"
					className="fixed left-1/2 top-[16%] z-[10001] w-[calc(100%-2rem)] max-w-[620px] -translate-x-1/2 rounded-xl border border-border bg-surface shadow-2xl ring-1 ring-black/5 focus:outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=open]:slide-in-from-top-4 data-[state=closed]:slide-out-to-top-2 duration-200"
				>
					<DialogPrimitive.Title className="sr-only">Command Palette</DialogPrimitive.Title>
					<DialogPrimitive.Description className="sr-only">
						Search and execute commands
					</DialogPrimitive.Description>

					{chatMode ? (
						<InlineAiChat
							key={chatQuery}
							initialQuery={chatQuery}
							onOpenInSidebar={handleOpenInSidebar}
							onBack={handleChatBack}
						/>
					) : (
						<>
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
								{isCommandMode && (
									<span className="shrink-0 rounded bg-accent/15 px-1.5 py-0.5 text-[11px] font-medium text-accent leading-none">
										Commands
									</span>
								)}
								<input
									ref={inputRef}
									value={query}
									onInput={(e) => handleQueryChange((e.target as HTMLInputElement).value)}
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
									{filtered.length === 0 && !showAskAi && (
										<div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
											<Search size={18} className="text-muted/40" />
											<p className="text-sm text-muted">No results for &ldquo;{query}&rdquo;</p>
										</div>
									)}

									{filtered.length === 0 && showAskAi && (
										<div className="px-3 pb-1 pt-2.5 text-[10px] font-semibold uppercase tracking-widest text-muted/60 select-none">
											No matching commands
										</div>
									)}

									{isInView
										? filtered.map((item, idx) => {
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
															<HighlightLabel label={item.label} query={effectiveQuery} />
														</span>
														{"description" in item && item.description && (
															<span className="text-xs text-muted shrink-0 ml-4">
																{item.description}
															</span>
														)}
													</button>
												)
											})
										: groups.map((group) => {
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
																		isSelected
																			? "bg-accent/10 text-fg"
																			: "text-fg hover:bg-surface-2"
																	}`}
																>
																	<span className="flex-1 truncate">
																		<HighlightLabel label={item.label} query={effectiveQuery} />
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

									{/* Pinned Ask AI / Continue chat row */}
									{showAskAi && (
										<>
											{filtered.length > 0 && (
												<div className="mx-1.5 my-1 border-t border-border" />
											)}
											<button
												type="button"
												data-selected={selectedIdx === askAiIdx}
												onClick={executeAskAi}
												onMouseEnter={() => setSelectedIdx(askAiIdx)}
												className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-left transition-colors ${
													selectedIdx === askAiIdx
														? "bg-accent/10 text-fg"
														: "text-fg hover:bg-surface-2"
												}`}
											>
												<Sparkles size={14} className="text-accent shrink-0" />
												<span className="flex-1 truncate">
													{trimmedQuery ? (
														<>
															Ask AI: <span className="text-muted italic">{trimmedQuery}</span>
														</>
													) : (
														<span className="text-muted">Continue AI chat</span>
													)}
												</span>
												{aiMessages.length > 0 && (
													<span className="text-[10px] text-muted shrink-0">
														{aiMessages.length} msg{aiMessages.length !== 1 ? "s" : ""}
													</span>
												)}
											</button>
										</>
									)}
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

							{/* Footer */}
							{!isTextInput && totalItems > 0 && (
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
						</>
					)}
				</DialogPrimitive.Content>
			</DialogPrimitive.Portal>
		</DialogPrimitive.Root>
	)
}
