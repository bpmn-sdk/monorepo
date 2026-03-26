import { X } from "lucide-react"
import { useEffect, useRef, useState } from "preact/hooks"
import { useLocation } from "wouter"
import { getProxyUrl } from "../api/client.js"
import { useUiStore } from "../stores/ui.js"

interface Message {
	id: string
	role: "user" | "assistant"
	content: string
}

function getContextLabel(path: string): string {
	if (path.startsWith("/definitions/")) return "Definition"
	if (path === "/definitions") return "Definitions"
	if (path.startsWith("/instances/")) return "Instance"
	if (path === "/instances") return "Instances"
	if (path.startsWith("/incidents/")) return "Incident"
	if (path === "/incidents") return "Incidents"
	if (path.startsWith("/models/")) return "Model"
	if (path === "/models") return "Models"
	if (path.startsWith("/tasks/")) return "Task"
	if (path === "/tasks") return "Tasks"
	if (path === "/") return "Dashboard"
	return "Studio"
}

export function AIDrawer() {
	const { aiOpen, aiInitialPrompt, closeAI } = useUiStore()
	const [location] = useLocation()
	const [messages, setMessages] = useState<Message[]>([])
	const [input, setInput] = useState("")
	const [loading, setLoading] = useState(false)
	const messagesEndRef = useRef<HTMLDivElement>(null)
	const textareaRef = useRef<HTMLTextAreaElement>(null)

	// Pre-fill input when opened with an initial prompt (e.g. from "Generate from OpenAPI spec")
	useEffect(() => {
		if (aiOpen && aiInitialPrompt) {
			setInput(aiInitialPrompt)
			setTimeout(() => textareaRef.current?.focus(), 50)
		}
	}, [aiOpen, aiInitialPrompt])

	const messageCount = messages.length
	// biome-ignore lint/correctness/useExhaustiveDependencies: scroll triggered by message count change
	useEffect(() => {
		messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
	}, [messageCount])

	async function sendMessage() {
		const text = input.trim()
		if (!text || loading) return

		const userMsg: Message = {
			id: crypto.randomUUID(),
			role: "user",
			content: text,
		}
		setMessages((prev) => [...prev, userMsg])
		setInput("")
		setLoading(true)

		const assistantId = crypto.randomUUID()
		setMessages((prev) => [...prev, { id: assistantId, role: "assistant", content: "" }])

		try {
			const context = `Current view: ${getContextLabel(location)}`
			const response = await fetch(`${getProxyUrl()}/stream`, {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({
					messages: [...messages, userMsg].map((m) => ({ role: m.role, content: m.content })),
					systemPrompt: `You are BPMNkit Studio AI assistant. ${context}`,
				}),
			})

			if (!response.ok || !response.body) {
				throw new Error(`HTTP ${response.status}`)
			}

			const reader = response.body.getReader()
			const decoder = new TextDecoder()
			let accumulated = ""

			while (true) {
				const { done, value } = await reader.read()
				if (done) break
				const chunk = decoder.decode(value, { stream: true })
				// Parse SSE lines
				for (const line of chunk.split("\n")) {
					if (line.startsWith("data: ")) {
						const data = line.slice(6)
						if (data === "[DONE]") break
						try {
							const parsed = JSON.parse(data) as { content?: string; delta?: string }
							const token = parsed.content ?? parsed.delta ?? ""
							accumulated += token
							setMessages((prev) =>
								prev.map((m) => (m.id === assistantId ? { ...m, content: accumulated } : m)),
							)
						} catch {
							accumulated += data
							setMessages((prev) =>
								prev.map((m) => (m.id === assistantId ? { ...m, content: accumulated } : m)),
							)
						}
					}
				}
			}
		} catch (err) {
			setMessages((prev) =>
				prev.map((m) =>
					m.id === assistantId
						? { ...m, content: `Error: ${err instanceof Error ? err.message : String(err)}` }
						: m,
				),
			)
		} finally {
			setLoading(false)
		}
	}

	function handleKeyDown(e: KeyboardEvent) {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault()
			void sendMessage()
		}
	}

	const contextLabel = getContextLabel(location)

	return (
		<div
			className={`flex w-[280px] shrink-0 flex-col border-l border-border bg-surface transition-all duration-200 ${
				aiOpen ? "translate-x-0" : "translate-x-full hidden"
			}`}
			aria-label="AI Assistant"
			role="complementary"
		>
			{/* Header */}
			<div className="flex items-center justify-between border-b border-border px-3 py-2">
				<div>
					<div className="text-sm font-medium text-fg">AI Assistant</div>
					<div className="text-xs text-muted">Talking about: {contextLabel}</div>
				</div>
				<button
					type="button"
					onClick={closeAI}
					className="text-muted hover:text-fg"
					aria-label="Close AI assistant"
				>
					<X size={16} />
				</button>
			</div>

			{/* Messages */}
			<div className="flex-1 overflow-y-auto p-3 space-y-3" aria-live="polite" aria-atomic="false">
				{messages.length === 0 && (
					<p className="text-center text-xs text-muted mt-8">
						Ask anything about your processes, instances, or incidents.
					</p>
				)}
				{messages.map((msg) => (
					<div
						key={msg.id}
						className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
					>
						<div
							className={`max-w-[90%] rounded-lg px-3 py-2 text-sm ${
								msg.role === "user" ? "bg-accent text-accent-fg" : "bg-surface-2 text-fg"
							}`}
						>
							{msg.content ||
								(loading && msg.role === "assistant" ? (
									<span className="animate-pulse text-muted">...</span>
								) : (
									""
								))}
						</div>
					</div>
				))}
				<div ref={messagesEndRef} />
			</div>

			{/* Input */}
			<div className="border-t border-border p-2">
				<div className="flex gap-2">
					<textarea
						ref={textareaRef}
						value={input}
						onInput={(e) => setInput((e.target as HTMLTextAreaElement).value)}
						onKeyDown={handleKeyDown}
						placeholder="Ask AI... (Enter to send)"
						className="flex-1 resize-none rounded border border-border bg-surface-2 px-2 py-1.5 text-sm text-fg placeholder:text-muted focus-visible:outline-2 focus-visible:outline-accent"
						rows={2}
						disabled={loading}
						aria-label="Message input"
					/>
				</div>
				<div className="mt-1 flex justify-between items-center">
					<span className="text-xs text-muted">Shift+Enter for newline</span>
					{messages.length > 0 && (
						<button
							type="button"
							onClick={() => setMessages([])}
							className="text-xs text-muted hover:text-fg"
						>
							Clear
						</button>
					)}
				</div>
			</div>
		</div>
	)
}
