import {
	AlertTriangle,
	CheckSquare,
	GitBranch,
	Layers,
	MessageSquare,
	Play,
	RefreshCw,
	Send,
	Zap,
} from "lucide-react"
import type { ComponentChildren } from "preact"
import { useEffect, useRef, useState } from "preact/hooks"
import { Link } from "wouter"
import { getActiveProfile, getProxyUrl } from "../api/client.js"
import {
	useDashboardStats,
	useDefinitions,
	useIncidents,
	useInstances,
	useJobs,
	useUserTasks,
} from "../api/queries.js"
import type { DashboardStats, ProcessDefinition } from "../api/types.js"
import { ErrorState } from "../components/ErrorState.js"
import { StatusPill } from "../components/StatusPill.js"
import { useModeStore } from "../stores/mode.js"
import { useModelsStore } from "../stores/models.js"
import { useUiStore } from "../stores/ui.js"

// ── Time series ────────────────────────────────────────────────────────────────

const TS_KEY = "bpmnkit:timeseries"
const TS_MAX = 24

interface TsPoint {
	t: number
	running: number
	incidents: number
}

function loadTimeSeries(): TsPoint[] {
	try {
		return JSON.parse(localStorage.getItem(TS_KEY) ?? "[]") as TsPoint[]
	} catch {
		return []
	}
}

function saveTimeSeries(pts: TsPoint[]): void {
	try {
		localStorage.setItem(TS_KEY, JSON.stringify(pts.slice(-TS_MAX)))
	} catch {
		/* ignore */
	}
}

function appendPoint(running: number, incidents: number): TsPoint[] {
	const pts = loadTimeSeries()
	pts.push({ t: Date.now(), running, incidents })
	const next = pts.slice(-TS_MAX)
	saveTimeSeries(next)
	return next
}

// ── Sparkline ──────────────────────────────────────────────────────────────────

function Sparkline({ values, stroke }: { values: number[]; stroke: string }) {
	if (values.length < 2) return null
	const w = 64
	const h = 28
	const pad = 2
	const min = Math.min(...values)
	const max = Math.max(...values)
	const range = max - min || 1
	const pts = values
		.map((v, i) => {
			const x = pad + (i / (values.length - 1)) * (w - pad * 2)
			const y = pad + (1 - (v - min) / range) * (h - pad * 2)
			return `${x.toFixed(1)},${y.toFixed(1)}`
		})
		.join(" ")
	return (
		<svg width={w} height={h} className="shrink-0 opacity-50" role="img" aria-label="Trend chart">
			<polyline
				points={pts}
				fill="none"
				stroke={stroke}
				strokeWidth="1.5"
				strokeLinejoin="round"
				strokeLinecap="round"
			/>
		</svg>
	)
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatRelativeTime(date: string): string {
	const diff = Date.now() - new Date(date).getTime()
	const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" })
	if (diff < 60_000) return rtf.format(-Math.floor(diff / 1000), "second")
	if (diff < 3_600_000) return rtf.format(-Math.floor(diff / 60_000), "minute")
	if (diff < 86_400_000) return rtf.format(-Math.floor(diff / 3_600_000), "hour")
	return rtf.format(-Math.floor(diff / 86_400_000), "day")
}

function SkeletonList() {
	return (
		<>
			<div className="h-5 animate-pulse rounded bg-surface-2" />
			<div className="h-5 animate-pulse rounded bg-surface-2 w-5/6" />
			<div className="h-5 animate-pulse rounded bg-surface-2 w-4/6" />
		</>
	)
}

function MiniRow({ href, children }: { href: string; children: ComponentChildren }) {
	return (
		<Link
			href={href}
			className="flex items-center gap-2 rounded-sm py-0.5 -mx-1 px-1 hover:bg-surface-2 transition-colors duration-100 text-xs"
		>
			{children}
		</Link>
	)
}

function groupDefinitions(
	items: ProcessDefinition[],
): Array<{ id: string; name: string; latest: ProcessDefinition }> {
	const map = new Map<string, ProcessDefinition[]>()
	for (const def of items) {
		const existing = map.get(def.processDefinitionId)
		if (existing) existing.push(def)
		else map.set(def.processDefinitionId, [def])
	}
	return Array.from(map.entries()).map(([id, versions]) => {
		const sorted = [...versions].sort((a, b) => (b.version ?? 0) - (a.version ?? 0))
		const latest = sorted[0] as ProcessDefinition
		return { id, name: latest.name || id, latest }
	})
}

function StatCard({
	icon: Icon,
	value,
	label,
	href,
	danger,
	sparkline,
	children,
}: {
	icon: typeof Play
	value: number | undefined
	label: string
	href: string
	danger?: boolean
	sparkline?: ComponentChildren
	children: ComponentChildren
}) {
	const isDangerous = danger && (value ?? 0) > 0
	return (
		<div
			className={`flex flex-col rounded-lg border bg-surface overflow-hidden transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg ${
				isDangerous ? "border-danger/50" : "border-border"
			}`}
		>
			<Link
				href={href}
				className="flex items-center gap-3 p-4 hover:bg-surface-2 transition-colors duration-150"
			>
				<div
					className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
						isDangerous ? "bg-danger/10 text-danger" : "bg-surface-2 text-muted"
					}`}
					aria-hidden="true"
				>
					<Icon size={20} />
				</div>
				<div className="flex-1 min-w-0">
					<div className="text-2xl font-bold text-fg">
						{value === undefined ? (
							<span className="h-7 w-12 animate-pulse rounded bg-surface-2 inline-block" />
						) : (
							value.toLocaleString()
						)}
					</div>
					<div className="text-sm text-muted">{label}</div>
				</div>
				{sparkline}
			</Link>

			<div className="border-t border-border/60 px-4 py-3 flex-1 flex flex-col gap-1.5">
				{children}
			</div>
		</div>
	)
}

// ── AI Chat ────────────────────────────────────────────────────────────────────

interface ChatMessage {
	role: "user" | "assistant"
	content: string
	streaming?: boolean
}

function AiChat({ stats }: { stats: DashboardStats | undefined }) {
	const [messages, setMessages] = useState<ChatMessage[]>([])
	const [input, setInput] = useState("")
	const [busy, setBusy] = useState(false)
	const scrollRef = useRef<HTMLDivElement>(null)
	const abortRef = useRef<AbortController | null>(null)

	// biome-ignore lint/correctness/useExhaustiveDependencies: scroll on message change
	useEffect(() => {
		if (scrollRef.current) {
			scrollRef.current.scrollTop = scrollRef.current.scrollHeight
		}
	}, [messages])

	async function send() {
		const text = input.trim()
		if (!text || busy) return
		setInput("")
		const userMsg: ChatMessage = { role: "user", content: text }
		setMessages((prev) => [...prev, userMsg])
		setBusy(true)

		const history = [...messages, userMsg].map((m) => ({ role: m.role, content: m.content }))
		const ab = new AbortController()
		abortRef.current = ab

		// Placeholder assistant message
		setMessages((prev) => [...prev, { role: "assistant", content: "", streaming: true }])

		try {
			const proxyUrl = getProxyUrl()
			const profile = getActiveProfile()
			const headers: Record<string, string> = { "Content-Type": "application/json" }
			if (profile) headers["x-profile"] = profile

			const res = await fetch(`${proxyUrl}/operate/chat`, {
				method: "POST",
				headers,
				body: JSON.stringify({ messages: history, stats: stats ?? null }),
				signal: ab.signal,
			})

			if (!res.ok || !res.body) {
				throw new Error(`HTTP ${res.status}`)
			}

			const reader = res.body.getReader()
			const dec = new TextDecoder()
			let buf = ""

			while (true) {
				const { done, value } = await reader.read()
				if (done) break
				buf += dec.decode(value, { stream: true })
				const lines = buf.split("\n")
				buf = lines.pop() ?? ""
				for (const line of lines) {
					if (!line.startsWith("data: ")) continue
					try {
						const evt = JSON.parse(line.slice(6)) as { type: string; text?: string }
						if (evt.type === "token" && evt.text) {
							setMessages((prev) => {
								const next = [...prev]
								const last = next[next.length - 1]
								if (last?.role === "assistant") {
									next[next.length - 1] = { ...last, content: last.content + evt.text }
								}
								return next
							})
						} else if (evt.type === "done") {
							setMessages((prev) => {
								const next = [...prev]
								const last = next[next.length - 1]
								if (last?.role === "assistant") {
									next[next.length - 1] = { ...last, streaming: false }
								}
								return next
							})
						}
					} catch {
						/* skip malformed */
					}
				}
			}
		} catch (err) {
			if ((err as { name?: string }).name !== "AbortError") {
				setMessages((prev) => {
					const next = [...prev]
					const last = next[next.length - 1]
					if (last?.role === "assistant") {
						next[next.length - 1] = {
							...last,
							content: `Error: ${String(err)}`,
							streaming: false,
						}
					}
					return next
				})
			}
		} finally {
			setBusy(false)
		}
	}

	function handleKeyDown(e: KeyboardEvent) {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault()
			void send()
		}
	}

	return (
		<div className="flex flex-col gap-2">
			{messages.length > 0 && (
				<div
					ref={scrollRef}
					className="flex flex-col gap-3 max-h-72 overflow-y-auto rounded-lg border border-border bg-surface p-4"
				>
					{messages.map((m, i) => (
						<div
							// biome-ignore lint/suspicious/noArrayIndexKey: static list
							key={i}
							className={`flex flex-col gap-1 ${m.role === "user" ? "items-end" : "items-start"}`}
						>
							<div
								className={`rounded-lg px-3 py-2 text-sm max-w-[80%] whitespace-pre-wrap ${
									m.role === "user"
										? "bg-accent text-white"
										: "bg-surface-2 text-fg border border-border/60"
								}`}
							>
								{m.content || (m.streaming ? <span className="animate-pulse">…</span> : "")}
							</div>
						</div>
					))}
				</div>
			)}
			<div className="flex items-center gap-2">
				<MessageSquare size={16} className="text-muted shrink-0" />
				<input
					type="text"
					value={input}
					onInput={(e) => setInput((e.target as HTMLInputElement).value)}
					onKeyDown={handleKeyDown}
					placeholder="Ask about your cluster or what to do next…"
					disabled={busy}
					className="flex-1 rounded border border-border bg-surface px-3 py-1.5 text-sm text-fg placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-50"
				/>
				<button
					type="button"
					onClick={() => void send()}
					disabled={busy || !input.trim()}
					className="flex items-center gap-1.5 rounded border border-border px-3 py-1.5 text-sm text-muted hover:text-fg disabled:opacity-40 transition-colors"
					aria-label="Send message"
				>
					<Send size={14} />
				</button>
			</div>
		</div>
	)
}

// ── Dashboard ──────────────────────────────────────────────────────────────────

export function Dashboard() {
	const { data: stats, isLoading, isError, refetch, dataUpdatedAt } = useDashboardStats()
	const { data: recentDefs } = useDefinitions()
	const { data: activeIncidents } = useIncidents({ state: "ACTIVE" })
	const { data: recentInstances } = useInstances({ state: "ACTIVE" })
	const { data: recentTasks } = useUserTasks()
	const { data: recentJobs } = useJobs({ state: "CREATED" })
	const { models } = useModelsStore()
	const { mode } = useModeStore()
	const { setBreadcrumbs } = useUiStore()
	const [refreshing, setRefreshing] = useState(false)
	const [timeSeries, setTimeSeries] = useState<TsPoint[]>(loadTimeSeries)

	useEffect(() => {
		setBreadcrumbs([{ label: "Dashboard" }])
	}, [setBreadcrumbs])

	// Append new data point when stats update
	// biome-ignore lint/correctness/useExhaustiveDependencies: dataUpdatedAt triggers when stats are fresh
	useEffect(() => {
		if (stats) {
			const next = appendPoint(stats.runningInstances, stats.activeIncidents)
			setTimeSeries(next)
		}
	}, [dataUpdatedAt, stats])

	async function handleRefresh() {
		setRefreshing(true)
		await refetch()
		setRefreshing(false)
	}

	if (isError) {
		return (
			<ErrorState
				title="Could not reach the cluster"
				description="The proxy server may not be running, or your cluster connection is misconfigured. Start the proxy and check your settings."
				hint="pnpm proxy"
				onRetry={() => void handleRefresh()}
				settingsHint
			/>
		)
	}

	const definitionGroups = groupDefinitions(recentDefs?.items ?? [])
	const runningValues = timeSeries.map((p) => p.running)
	const incidentValues = timeSeries.map((p) => p.incidents)

	return (
		<div className="p-6 max-w-6xl mx-auto animate-in fade-in slide-in-from-bottom-2 duration-300 flex flex-col gap-6">
			<div className="flex items-center gap-3">
				<div className="flex-1">
					<AiChat stats={stats} />
				</div>
				<button
					type="button"
					onClick={() => void handleRefresh()}
					disabled={refreshing || isLoading}
					className="flex items-center gap-1.5 rounded border border-border px-2.5 py-1 text-sm text-muted hover:text-fg disabled:opacity-50 transition-colors duration-150 shrink-0"
					aria-label="Refresh dashboard"
				>
					<RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
					Refresh
				</button>
			</div>

			<div className="grid grid-cols-2 gap-4 md:grid-cols-3">
				{/* Card order: Ops sees Tasks (act now) → Incidents → Instances; Dev sees Instances → Incidents → Tasks */}

				{/* Pending Tasks — Ops: slot 1 (overdue sorted first); Dev: slot 3 */}
				{mode === "operator" && (
					<StatCard
						icon={CheckSquare}
						value={isLoading ? undefined : stats?.pendingTasks}
						label="Pending Tasks"
						href="/tasks"
						danger={
							recentTasks
								? recentTasks.items.some((t) => t.dueDate && new Date(t.dueDate) < new Date())
								: false
						}
					>
						{!recentTasks ? (
							<SkeletonList />
						) : recentTasks.items.length === 0 ? (
							<p className="text-xs text-muted">No pending tasks.</p>
						) : (
							[...recentTasks.items]
								.sort((a, b) => {
									const aOver = a.dueDate && new Date(a.dueDate) < new Date() ? 0 : 1
									const bOver = b.dueDate && new Date(b.dueDate) < new Date() ? 0 : 1
									return aOver - bOver
								})
								.slice(0, 4)
								.map((task) => {
									const overdue = task.dueDate && new Date(task.dueDate) < new Date()
									return (
										<MiniRow key={task.userTaskKey} href={`/tasks/${task.userTaskKey}`}>
											<span className={`truncate flex-1 ${overdue ? "text-danger" : "text-fg"}`}>
												{task.name || `Task ${task.userTaskKey}`}
											</span>
											<span className="text-muted shrink-0 italic">
												{task.assignee ?? "Unassigned"}
											</span>
										</MiniRow>
									)
								})
						)}
					</StatCard>
				)}

				{/* Active Incidents — prominent in both modes */}
				<StatCard
					icon={AlertTriangle}
					value={isLoading ? undefined : stats?.activeIncidents}
					label="Active Incidents"
					href="/incidents"
					danger
					sparkline={<Sparkline values={incidentValues} stroke="var(--bpmnkit-danger)" />}
				>
					{!activeIncidents ? (
						<SkeletonList />
					) : activeIncidents.items.length === 0 ? (
						<p className="text-xs text-success">No active incidents.</p>
					) : (
						activeIncidents.items.slice(0, 4).map((inc) => (
							<MiniRow key={inc.incidentKey} href={`/incidents/${inc.incidentKey}`}>
								<span className="truncate text-danger flex-1 font-mono">{inc.errorType}</span>
								{inc.creationTime && (
									<span className="text-muted shrink-0">
										{formatRelativeTime(inc.creationTime)}
									</span>
								)}
							</MiniRow>
						))
					)}
				</StatCard>

				{/* Running Instances — Dev: slot 1; Ops: slot 3 */}
				<StatCard
					icon={Play}
					value={isLoading ? undefined : stats?.runningInstances}
					label="Running Instances"
					href="/instances"
					sparkline={<Sparkline values={runningValues} stroke="var(--bpmnkit-accent)" />}
				>
					{!recentInstances ? (
						<SkeletonList />
					) : recentInstances.items.length === 0 ? (
						<p className="text-xs text-muted">No active instances.</p>
					) : (
						recentInstances.items.slice(0, 4).map((inst) => (
							<MiniRow key={inst.processInstanceKey} href={`/instances/${inst.processInstanceKey}`}>
								<span className="truncate text-fg flex-1">{inst.processDefinitionId}</span>
								<StatusPill state={inst.state} />
								{inst.startDate && (
									<span className="text-muted shrink-0">{formatRelativeTime(inst.startDate)}</span>
								)}
							</MiniRow>
						))
					)}
				</StatCard>

				{/* Pending Tasks — Dev: slot 3 */}
				{mode === "developer" && (
					<StatCard
						icon={CheckSquare}
						value={isLoading ? undefined : stats?.pendingTasks}
						label="Pending Tasks"
						href="/tasks"
					>
						{!recentTasks ? (
							<SkeletonList />
						) : recentTasks.items.length === 0 ? (
							<p className="text-xs text-muted">No pending tasks.</p>
						) : (
							recentTasks.items.slice(0, 4).map((task) => (
								<MiniRow key={task.userTaskKey} href={`/tasks/${task.userTaskKey}`}>
									<span className="truncate text-fg flex-1">
										{task.name || `Task ${task.userTaskKey}`}
									</span>
									<span className="text-muted shrink-0 italic">
										{task.assignee ?? "Unassigned"}
									</span>
								</MiniRow>
							))
						)}
					</StatCard>
				)}

				{/* Deployed Definitions */}
				<StatCard
					icon={Layers}
					value={isLoading ? undefined : stats?.deployedDefinitions}
					label="Deployed Definitions"
					href="/definitions"
				>
					{!recentDefs ? (
						<SkeletonList />
					) : definitionGroups.length === 0 ? (
						<p className="text-xs text-muted">No definitions deployed yet.</p>
					) : (
						definitionGroups.slice(0, 4).map((g) => (
							<MiniRow key={g.id} href={`/definitions/${g.latest.processDefinitionKey}`}>
								<span className="truncate text-fg flex-1">{g.name}</span>
								<span className="text-muted shrink-0">v{g.latest.version}</span>
								{g.latest.deploymentTime && (
									<span className="text-muted shrink-0">
										{formatRelativeTime(g.latest.deploymentTime)}
									</span>
								)}
							</MiniRow>
						))
					)}
				</StatCard>

				{/* Active Jobs — Dev: technical detail; Ops: last slot */}
				<StatCard
					icon={Zap}
					value={isLoading ? undefined : stats?.activeJobs}
					label="Active Jobs"
					href="/instances"
				>
					{!recentJobs ? (
						<SkeletonList />
					) : recentJobs.items.length === 0 ? (
						<p className="text-xs text-muted">No active jobs.</p>
					) : (
						recentJobs.items.slice(0, 4).map((job) => (
							<MiniRow
								key={job.jobKey}
								href={
									job.processInstanceKey ? `/instances/${job.processInstanceKey}` : "/instances"
								}
							>
								<span className="truncate text-fg flex-1 font-mono">{job.type}</span>
								{job.processInstanceKey && (
									<span className="text-muted shrink-0 font-mono">
										…{job.processInstanceKey.slice(-6)}
									</span>
								)}
							</MiniRow>
						))
					)}
				</StatCard>

				{/* Local Models — Dev only */}
				{mode === "developer" && (
					<StatCard icon={GitBranch} value={models.length} label="Local Models" href="/models">
						{models.length === 0 ? (
							<p className="text-xs text-muted">No local models yet.</p>
						) : (
							models.slice(0, 4).map((m) => (
								<MiniRow key={m.id} href={`/models/${m.id}`}>
									<span className="truncate text-fg flex-1">{m.name}</span>
									<span className="text-muted shrink-0 uppercase text-[10px] tracking-wider">
										{m.type}
									</span>
								</MiniRow>
							))
						)}
					</StatCard>
				)}
			</div>
		</div>
	)
}
