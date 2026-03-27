import {
	AlertTriangle,
	CheckSquare,
	FileCode2,
	GitBranch,
	Layers,
	Play,
	RefreshCw,
	Rocket,
	WifiOff,
	X,
	Zap,
} from "lucide-react"
import type { ComponentChildren } from "preact"
import { useEffect, useState } from "preact/hooks"
import { Link } from "wouter"
import {
	useDashboardStats,
	useDefinitions,
	useIncidents,
	useInstances,
	useJobs,
	useUserTasks,
} from "../api/queries.js"
import type { ProcessDefinition } from "../api/types.js"
import { ProfileTag } from "../components/ProfileTag.js"
import { StatusPill } from "../components/StatusPill.js"
import { useClusterStore } from "../stores/cluster.js"
import { useModeStore } from "../stores/mode.js"
import { useModelsStore } from "../stores/models.js"
import { useUiStore } from "../stores/ui.js"

// ── Time series ───────────────────────────────────────────────────────────────

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

// ── Sparkline ─────────────────────────────────────────────────────────────────

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

// ── Helpers ───────────────────────────────────────────────────────────────────

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

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({
	icon: Icon,
	value,
	label,
	href,
	danger,
	sparkline,
	offline,
	children,
}: {
	icon: typeof Play
	value: number | undefined
	label: string
	href: string
	danger?: boolean
	sparkline?: ComponentChildren
	offline?: boolean
	children: ComponentChildren
}) {
	const isDangerous = !offline && danger && (value ?? 0) > 0
	return (
		<div
			className={`relative flex flex-col rounded-lg border bg-surface overflow-hidden transition-all duration-200 ${
				offline ? "opacity-60" : "hover:-translate-y-0.5 hover:shadow-lg"
			} ${isDangerous ? "border-danger/50" : "border-border"}`}
		>
			{/* Live alert indicator — pulses when danger state is active */}
			{isDangerous && (
				<span className="absolute top-3 right-3 flex h-2.5 w-2.5" aria-hidden="true">
					<span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-danger opacity-60" />
					<span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-danger" />
				</span>
			)}

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
						{offline ? (
							<span className="text-muted font-normal">—</span>
						) : value === undefined ? (
							<span className="h-7 w-12 animate-pulse rounded bg-surface-2 inline-block" />
						) : (
							value.toLocaleString()
						)}
					</div>
					<div className="text-sm text-muted">{label}</div>
				</div>
				{!offline && sparkline}
			</Link>

			<div className="border-t border-border/60 px-4 py-3 flex-1 flex flex-col gap-1.5">
				{offline ? <p className="text-xs text-muted">No data — proxy not running.</p> : children}
			</div>
		</div>
	)
}

// ── Status header ─────────────────────────────────────────────────────────────

function StatusHeader({
	activeProfile,
	profileTags,
	status,
	lastUpdatedAt,
	onRefresh,
	refreshing,
}: {
	activeProfile: string | null
	profileTags?: string[]
	status: "connected" | "offline" | "loading"
	lastUpdatedAt: number
	onRefresh: () => void
	refreshing: boolean
}) {
	// Tick every 10 s so the "Updated X ago" label stays current
	const [, setTick] = useState(0)
	useEffect(() => {
		const id = setInterval(() => setTick((n) => n + 1), 10_000)
		return () => clearInterval(id)
	}, [])

	const dotClass =
		status === "connected"
			? "bg-success"
			: status === "loading"
				? "bg-warn animate-pulse"
				: "bg-danger"

	const statusLabel =
		status === "connected" ? "Connected" : status === "loading" ? "Connecting…" : "Offline"

	const updatedLabel =
		lastUpdatedAt > 0
			? `Updated ${formatRelativeTime(new Date(lastUpdatedAt).toISOString())}`
			: null

	return (
		<div className="flex items-center gap-3">
			<div className="flex items-center gap-2.5 flex-1 min-w-0">
				<span className={`h-2 w-2 shrink-0 rounded-full ${dotClass}`} aria-hidden="true" />
				<span className="text-sm font-semibold text-fg truncate">
					{activeProfile ?? "No profile selected"}
				</span>
				{profileTags && profileTags.length > 0 && (
					<div className="flex items-center gap-1 shrink-0">
						{profileTags.map((t) => (
							<ProfileTag key={t} tag={t} />
						))}
					</div>
				)}
				<span className="text-xs text-muted shrink-0">{statusLabel}</span>
				{updatedLabel && (
					<span className="hidden text-xs text-muted/60 shrink-0 md:block">· {updatedLabel}</span>
				)}
			</div>
			<button
				type="button"
				onClick={onRefresh}
				disabled={refreshing || status === "loading"}
				className="flex items-center gap-1.5 rounded border border-border px-2.5 py-1 text-sm text-muted hover:text-fg disabled:opacity-50 transition-colors duration-150 shrink-0"
				aria-label={status === "offline" ? "Retry proxy connection" : "Refresh dashboard"}
			>
				<RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
				{status === "offline" ? "Retry" : "Refresh"}
			</button>
		</div>
	)
}

// ── Incident alert banner ─────────────────────────────────────────────────────

function IncidentBanner({ count, onDismiss }: { count: number; onDismiss: () => void }) {
	return (
		<div className="flex items-center gap-3 rounded-lg border border-danger/40 bg-danger/10 px-4 py-3">
			<AlertTriangle size={15} className="text-danger shrink-0" />
			<span className="flex-1 text-sm font-medium text-danger">
				{count === 1 ? "1 active incident" : `${count.toLocaleString()} active incidents`} requiring
				attention
			</span>
			<Link
				href="/incidents"
				className="shrink-0 whitespace-nowrap text-sm font-medium text-danger hover:underline"
			>
				View all →
			</Link>
			<button
				type="button"
				onClick={onDismiss}
				className="ml-1 shrink-0 text-danger/50 hover:text-danger transition-colors duration-150"
				aria-label="Dismiss alert"
			>
				<X size={14} />
			</button>
		</div>
	)
}

// ── Offline panel ─────────────────────────────────────────────────────────────

function OfflinePanel({
	proxyUrl,
	onRetry,
	retrying,
}: {
	proxyUrl: string
	onRetry: () => void
	retrying: boolean
}) {
	return (
		<div className="flex flex-col items-center gap-5 rounded-xl border border-border bg-surface p-10 text-center">
			<div className="flex h-14 w-14 items-center justify-center rounded-full bg-surface-2">
				<WifiOff size={26} className="text-muted" />
			</div>
			<div className="flex flex-col gap-1.5">
				<h3 className="text-base font-semibold text-fg">Proxy not running</h3>
				<p className="max-w-xs text-sm text-muted">
					Start the proxy server to connect to your Camunda cluster and see live data.
				</p>
			</div>
			<div className="flex flex-col items-center gap-2">
				<code className="select-all rounded-md border border-border bg-surface-2 px-4 py-2 font-mono text-sm text-fg">
					pnpm proxy
				</code>
				<span className="text-xs text-muted">
					or set a different URL in{" "}
					<Link href="/settings" className="text-accent hover:underline">
						Settings
					</Link>
				</span>
			</div>
			<button
				type="button"
				onClick={onRetry}
				disabled={retrying}
				className="flex items-center gap-2 rounded-lg border border-border px-5 py-2 text-sm font-medium text-fg hover:bg-surface-2 transition-colors duration-150 disabled:opacity-50"
			>
				<RefreshCw size={14} className={retrying ? "animate-spin" : ""} />
				{retrying ? "Connecting…" : "Retry connection"}
			</button>
			<p className="text-xs text-muted/50">{proxyUrl}</p>
		</div>
	)
}

// ── Getting started ───────────────────────────────────────────────────────────

const STEPS = [
	{
		n: 1,
		icon: FileCode2,
		title: "Create a model",
		body: "Design a BPMN process in the visual editor or import an existing file.",
		href: "/models",
	},
	{
		n: 2,
		icon: Rocket,
		title: "Deploy a definition",
		body: "Push your model to the connected Camunda cluster to make it runnable.",
		href: "/definitions",
	},
	{
		n: 3,
		icon: Play,
		title: "Start an instance",
		body: "Trigger a process instance and monitor its state in real time.",
		href: "/instances",
	},
]

function GettingStarted() {
	return (
		<div className="flex flex-col gap-3">
			<p className="text-[11px] font-semibold uppercase tracking-widest text-muted/60">
				Get started
			</p>
			<div className="grid gap-3 sm:grid-cols-3">
				{STEPS.map(({ n, icon: Icon, title, body, href }) => (
					<Link
						key={n}
						href={href}
						className="group flex flex-col gap-3 rounded-lg border border-border bg-surface p-4 transition-all duration-150 hover:border-accent/50 hover:bg-surface-2"
					>
						<div className="flex items-center gap-3">
							<span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-accent/10 text-xs font-bold text-accent">
								{n}
							</span>
							<Icon
								size={15}
								className="text-muted transition-colors duration-150 group-hover:text-accent"
							/>
						</div>
						<div>
							<p className="text-sm font-medium text-fg">{title}</p>
							<p className="mt-0.5 text-xs leading-relaxed text-muted">{body}</p>
						</div>
					</Link>
				))}
			</div>
		</div>
	)
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

export function Dashboard() {
	const { data: stats, isLoading, refetch, dataUpdatedAt } = useDashboardStats()
	const { data: recentDefs } = useDefinitions()
	const { data: activeIncidents } = useIncidents({ state: "ACTIVE" })
	const { data: recentInstances } = useInstances({ state: "ACTIVE" })
	const { data: recentTasks } = useUserTasks()
	const { data: recentJobs } = useJobs({ state: "CREATED" })
	const { models } = useModelsStore()
	const { mode } = useModeStore()
	const { setBreadcrumbs } = useUiStore()
	const { status, proxyUrl, profiles, activeProfile, loadProfiles } = useClusterStore()
	const [refreshing, setRefreshing] = useState(false)
	const [timeSeries, setTimeSeries] = useState<TsPoint[]>(loadTimeSeries)
	const [bannerDismissed, setBannerDismissed] = useState(false)

	const isOffline = status === "offline"
	const isDataLoading = status === "loading" || isLoading

	const definitionGroups = groupDefinitions(recentDefs?.items ?? [])
	const runningValues = timeSeries.map((p) => p.running)
	const incidentValues = timeSeries.map((p) => p.incidents)
	const activeProfileData = profiles.find((p) => p.name === activeProfile)
	const activeIncidentCount = stats?.activeIncidents ?? 0
	const showBanner = !isOffline && !bannerDismissed && activeIncidentCount > 0
	const showGettingStarted =
		!isOffline &&
		!isDataLoading &&
		stats?.deployedDefinitions === 0 &&
		stats?.runningInstances === 0

	useEffect(() => {
		setBreadcrumbs([{ label: "Dashboard" }])
	}, [setBreadcrumbs])

	// biome-ignore lint/correctness/useExhaustiveDependencies: dataUpdatedAt triggers when stats are fresh
	useEffect(() => {
		if (stats) {
			setTimeSeries(appendPoint(stats.runningInstances, stats.activeIncidents))
		}
	}, [dataUpdatedAt, stats])

	// Re-surface the banner when incident count rises
	useEffect(() => {
		if (activeIncidentCount > 0) setBannerDismissed(false)
	}, [activeIncidentCount])

	async function handleRefresh() {
		setRefreshing(true)
		if (isOffline) {
			await loadProfiles()
		} else {
			await refetch()
		}
		setRefreshing(false)
	}

	return (
		<div className="flex flex-col gap-5 p-6 max-w-6xl mx-auto animate-in fade-in slide-in-from-bottom-2 duration-300">
			{/* Status header */}
			<StatusHeader
				activeProfile={activeProfile}
				profileTags={activeProfileData?.tags}
				status={status}
				lastUpdatedAt={dataUpdatedAt}
				onRefresh={() => void handleRefresh()}
				refreshing={refreshing}
			/>

			{/* Incident alert banner */}
			{showBanner && (
				<IncidentBanner count={activeIncidentCount} onDismiss={() => setBannerDismissed(true)} />
			)}

			{isOffline ? (
				/* ── Offline state ──────────────────────────────────────────────── */
				<div className="flex flex-col gap-5">
					<OfflinePanel
						proxyUrl={proxyUrl}
						onRetry={() => void handleRefresh()}
						retrying={refreshing}
					/>
					{/* Local models are still accessible when offline */}
					{mode === "developer" && models.length > 0 && (
						<div className="flex flex-col gap-3">
							<p className="text-[11px] font-semibold uppercase tracking-widest text-muted/60">
								Local Models
							</p>
							<div className="overflow-hidden rounded-lg border border-border bg-surface">
								{models.slice(0, 6).map((m) => (
									<Link
										key={m.id}
										href={`/models/${m.id}`}
										className="flex items-center gap-3 border-b border-border/50 px-4 py-2.5 text-sm transition-colors duration-100 hover:bg-surface-2 last:border-0"
									>
										<span className="flex-1 truncate text-fg">{m.name}</span>
										<span className="shrink-0 text-[10px] uppercase tracking-wider text-muted">
											{m.type}
										</span>
									</Link>
								))}
							</div>
						</div>
					)}
				</div>
			) : (
				/* ── Connected state ────────────────────────────────────────────── */
				<>
					<div className="grid grid-cols-2 gap-4 md:grid-cols-3">
						{/* Operator: tasks first — highest urgency */}
						{mode === "operator" && (
							<StatCard
								icon={CheckSquare}
								value={isDataLoading ? undefined : stats?.pendingTasks}
								label="Pending Tasks"
								href="/tasks"
								offline={isOffline}
								danger={recentTasks?.items.some(
									(t) => t.dueDate && new Date(t.dueDate) < new Date(),
								)}
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
													<span
														className={`flex-1 truncate ${overdue ? "text-danger" : "text-fg"}`}
													>
														{task.name || `Task ${task.userTaskKey}`}
													</span>
													<span className="shrink-0 italic text-muted">
														{task.assignee ?? "Unassigned"}
													</span>
												</MiniRow>
											)
										})
								)}
							</StatCard>
						)}

						{/* Active incidents — always prominent, live indicator when count > 0 */}
						<StatCard
							icon={AlertTriangle}
							value={isDataLoading ? undefined : stats?.activeIncidents}
							label="Active Incidents"
							href="/incidents"
							offline={isOffline}
							danger
							sparkline={<Sparkline values={incidentValues} stroke="var(--bpmnkit-danger)" />}
						>
							{!activeIncidents ? (
								<SkeletonList />
							) : activeIncidents.items.length === 0 ? (
								<p className="text-xs text-success">No active incidents — processes healthy.</p>
							) : (
								activeIncidents.items.slice(0, 4).map((inc) => (
									<MiniRow key={inc.incidentKey} href={`/incidents/${inc.incidentKey}`}>
										<span className="flex-1 truncate font-mono text-danger">{inc.errorType}</span>
										{inc.creationTime && (
											<span className="shrink-0 text-muted">
												{formatRelativeTime(inc.creationTime)}
											</span>
										)}
									</MiniRow>
								))
							)}
						</StatCard>

						{/* Running instances */}
						<StatCard
							icon={Play}
							value={isDataLoading ? undefined : stats?.runningInstances}
							label="Running Instances"
							href="/instances"
							offline={isOffline}
							sparkline={<Sparkline values={runningValues} stroke="var(--bpmnkit-accent)" />}
						>
							{!recentInstances ? (
								<SkeletonList />
							) : recentInstances.items.length === 0 ? (
								<p className="text-xs text-muted">
									No active instances.{" "}
									<Link href="/definitions" className="text-accent hover:underline">
										Deploy a definition
									</Link>{" "}
									to start one.
								</p>
							) : (
								recentInstances.items.slice(0, 4).map((inst) => (
									<MiniRow
										key={inst.processInstanceKey}
										href={`/instances/${inst.processInstanceKey}`}
									>
										<span className="flex-1 truncate text-fg">{inst.processDefinitionId}</span>
										<StatusPill state={inst.state} />
										{inst.startDate && (
											<span className="shrink-0 text-muted">
												{formatRelativeTime(inst.startDate)}
											</span>
										)}
									</MiniRow>
								))
							)}
						</StatCard>

						{/* Developer: tasks in third slot */}
						{mode === "developer" && (
							<StatCard
								icon={CheckSquare}
								value={isDataLoading ? undefined : stats?.pendingTasks}
								label="Pending Tasks"
								href="/tasks"
								offline={isOffline}
							>
								{!recentTasks ? (
									<SkeletonList />
								) : recentTasks.items.length === 0 ? (
									<p className="text-xs text-muted">No pending tasks.</p>
								) : (
									recentTasks.items.slice(0, 4).map((task) => (
										<MiniRow key={task.userTaskKey} href={`/tasks/${task.userTaskKey}`}>
											<span className="flex-1 truncate text-fg">
												{task.name || `Task ${task.userTaskKey}`}
											</span>
											<span className="shrink-0 italic text-muted">
												{task.assignee ?? "Unassigned"}
											</span>
										</MiniRow>
									))
								)}
							</StatCard>
						)}

						{/* Deployed definitions */}
						<StatCard
							icon={Layers}
							value={isDataLoading ? undefined : stats?.deployedDefinitions}
							label="Deployed Definitions"
							href="/definitions"
							offline={isOffline}
						>
							{!recentDefs ? (
								<SkeletonList />
							) : definitionGroups.length === 0 ? (
								<p className="text-xs text-muted">
									No definitions deployed.{" "}
									<Link href="/models" className="text-accent hover:underline">
										Create a model
									</Link>{" "}
									to get started.
								</p>
							) : (
								definitionGroups.slice(0, 4).map((g) => (
									<MiniRow key={g.id} href={`/definitions/${g.latest.processDefinitionKey}`}>
										<span className="flex-1 truncate text-fg">{g.name}</span>
										<span className="shrink-0 text-muted">v{g.latest.version}</span>
										{g.latest.deploymentTime && (
											<span className="shrink-0 text-muted">
												{formatRelativeTime(g.latest.deploymentTime)}
											</span>
										)}
									</MiniRow>
								))
							)}
						</StatCard>

						{/* Active jobs */}
						<StatCard
							icon={Zap}
							value={isDataLoading ? undefined : stats?.activeJobs}
							label="Active Jobs"
							href="/instances"
							offline={isOffline}
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
										<span className="flex-1 truncate font-mono text-fg">{job.type}</span>
										{job.processInstanceKey && (
											<span className="shrink-0 font-mono text-muted">
												…{job.processInstanceKey.slice(-6)}
											</span>
										)}
									</MiniRow>
								))
							)}
						</StatCard>

						{/* Developer only: local models */}
						{mode === "developer" && (
							<StatCard icon={GitBranch} value={models.length} label="Local Models" href="/models">
								{models.length === 0 ? (
									<p className="text-xs text-muted">
										No local models.{" "}
										<Link href="/models" className="text-accent hover:underline">
											Create your first model
										</Link>
										.
									</p>
								) : (
									models.slice(0, 4).map((m) => (
										<MiniRow key={m.id} href={`/models/${m.id}`}>
											<span className="flex-1 truncate text-fg">{m.name}</span>
											<span className="shrink-0 text-[10px] uppercase tracking-wider text-muted">
												{m.type}
											</span>
										</MiniRow>
									))
								)}
							</StatCard>
						)}
					</div>

					{/* Getting-started guide — shown on a fresh empty cluster */}
					{showGettingStarted && <GettingStarted />}
				</>
			)}
		</div>
	)
}
