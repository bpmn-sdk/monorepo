import { AlertTriangle, CheckSquare, GitBranch, Layers, Play, RefreshCw, Zap } from "lucide-react"
import { useState } from "preact/hooks"
import { Link } from "wouter"
import { useDashboardStats, useDefinitions, useIncidents, useInstances } from "../api/queries.js"
import { StatusPill } from "../components/StatusPill.js"
import { useModeStore } from "../stores/mode.js"
import { useModelsStore } from "../stores/models.js"

function StatCard({
	icon: Icon,
	value,
	label,
	href,
	danger,
}: {
	icon: typeof Play
	value: number | undefined
	label: string
	href: string
	danger?: boolean
}) {
	return (
		<Link
			href={href}
			className={`flex items-center gap-4 rounded-lg border p-4 transition-all duration-200 hover:bg-surface-2 hover:-translate-y-0.5 hover:shadow-lg ${
				danger && (value ?? 0) > 0 ? "border-danger/50" : "border-border"
			} bg-surface`}
		>
			<div
				className={`flex h-10 w-10 items-center justify-center rounded-lg ${
					danger && (value ?? 0) > 0 ? "bg-danger/10 text-danger" : "bg-surface-2 text-muted"
				}`}
				aria-hidden="true"
			>
				<Icon size={20} />
			</div>
			<div>
				<div className="text-2xl font-bold text-fg">
					{value === undefined ? (
						<span className="h-7 w-12 animate-pulse rounded bg-surface-2 inline-block" />
					) : (
						value.toLocaleString()
					)}
				</div>
				<div className="text-sm text-muted">{label}</div>
			</div>
		</Link>
	)
}

function formatRelativeTime(date: string): string {
	const diff = Date.now() - new Date(date).getTime()
	const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" })
	if (diff < 60_000) return rtf.format(-Math.floor(diff / 1000), "second")
	if (diff < 3_600_000) return rtf.format(-Math.floor(diff / 60_000), "minute")
	if (diff < 86_400_000) return rtf.format(-Math.floor(diff / 3_600_000), "hour")
	return rtf.format(-Math.floor(diff / 86_400_000), "day")
}

export function Dashboard() {
	const { data: stats, isLoading, isError, refetch, dataUpdatedAt } = useDashboardStats()
	const { data: recentDefs } = useDefinitions()
	const { data: activeIncidents } = useIncidents({ state: "ACTIVE" })
	const { data: recentInstances } = useInstances()
	const { models } = useModelsStore()
	const { mode } = useModeStore()
	const [refreshing, setRefreshing] = useState(false)

	async function handleRefresh() {
		setRefreshing(true)
		await refetch()
		setRefreshing(false)
	}

	if (isError) {
		return (
			<div className="flex flex-col items-center justify-center h-full gap-4 text-center p-8">
				<AlertTriangle size={40} className="text-danger" />
				<div>
					<h2 className="text-lg font-semibold text-fg">Could not reach cluster</h2>
					<p className="text-sm text-muted mt-1">Is the proxy running?</p>
					<code className="mt-2 block rounded bg-surface-2 px-3 py-1.5 text-xs font-mono text-muted">
						pnpm proxy
					</code>
				</div>
				<button
					type="button"
					onClick={handleRefresh}
					className="flex items-center gap-2 rounded border border-border px-3 py-1.5 text-sm hover:bg-surface-2"
				>
					<RefreshCw size={14} />
					Retry
				</button>
			</div>
		)
	}

	const updatedAt = dataUpdatedAt
		? new Intl.RelativeTimeFormat("en", { numeric: "auto" }).format(
				-Math.floor((Date.now() - dataUpdatedAt) / 1000),
				"second",
			)
		: null

	return (
		<div className="p-6 max-w-6xl mx-auto animate-in fade-in slide-in-from-bottom-2 duration-300">
			<div className="flex items-center justify-between mb-6">
				<div>
					<h1 className="text-xl font-semibold text-fg">Dashboard</h1>
					{updatedAt && <p className="text-xs text-muted mt-0.5">Updated {updatedAt}</p>}
				</div>
				<button
					type="button"
					onClick={handleRefresh}
					disabled={refreshing || isLoading}
					className="flex items-center gap-1.5 rounded border border-border px-2.5 py-1 text-sm text-muted hover:text-fg disabled:opacity-50"
					aria-label="Refresh dashboard"
				>
					<RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
					Refresh
				</button>
			</div>

			{/* Stat cards grid */}
			<div className="grid grid-cols-2 gap-4 md:grid-cols-3 mb-8">
				<StatCard
					icon={Play}
					value={isLoading ? undefined : stats?.runningInstances}
					label="Running Instances"
					href="/instances"
				/>
				<StatCard
					icon={AlertTriangle}
					value={isLoading ? undefined : stats?.activeIncidents}
					label="Active Incidents"
					href="/incidents"
					danger
				/>
				<StatCard
					icon={CheckSquare}
					value={isLoading ? undefined : stats?.pendingTasks}
					label="Pending Tasks"
					href="/tasks"
				/>
				<StatCard
					icon={Layers}
					value={isLoading ? undefined : stats?.deployedDefinitions}
					label="Deployed Definitions"
					href="/definitions"
				/>
				<StatCard
					icon={Zap}
					value={isLoading ? undefined : stats?.activeJobs}
					label="Active Jobs"
					href="/instances"
				/>
				{mode === "developer" ? (
					<StatCard icon={GitBranch} value={models.length} label="Local Models" href="/models" />
				) : (
					<StatCard
						icon={CheckSquare}
						value={isLoading ? undefined : stats?.pendingTasks}
						label="Overdue Tasks"
						href="/tasks"
						danger
					/>
				)}
			</div>

			{/* Recent lists */}
			<div className="grid grid-cols-1 gap-6 md:grid-cols-3">
				{/* Recent Definitions */}
				<div className="rounded-lg border border-border bg-surface p-4">
					<h2 className="text-sm font-medium text-fg mb-3">Recent Definitions</h2>
					{recentDefs?.items.length === 0 ? (
						<p className="text-xs text-muted">No definitions deployed yet.</p>
					) : (
						<ul className="space-y-2">
							{recentDefs?.items.slice(0, 5).map((def) => (
								<li key={def.processDefinitionKey}>
									<Link
										href={`/definitions/${def.processDefinitionKey}`}
										className="flex items-center justify-between hover:text-accent text-sm"
									>
										<span className="truncate text-fg">{def.name || def.processDefinitionId}</span>
										<span className="text-xs text-muted shrink-0 ml-2">v{def.version}</span>
									</Link>
								</li>
							)) ??
								(["s0", "s1", "s2"] as const).map((sk) => (
									<li key={sk} className="h-5 animate-pulse rounded bg-surface-2" />
								))}
						</ul>
					)}
				</div>

				{/* Active Incidents */}
				<div className="rounded-lg border border-border bg-surface p-4">
					<h2 className="text-sm font-medium text-fg mb-3">Active Incidents</h2>
					{activeIncidents?.items.length === 0 ? (
						<p className="text-xs text-success">No active incidents!</p>
					) : (
						<ul className="space-y-2">
							{activeIncidents?.items.slice(0, 5).map((inc) => (
								<li key={inc.incidentKey}>
									<Link
										href={`/incidents/${inc.incidentKey}`}
										className="block text-sm hover:text-accent"
									>
										<span className="truncate text-danger">{inc.errorType}</span>
										<p className="text-xs text-muted truncate">{inc.errorMessage.slice(0, 60)}</p>
									</Link>
								</li>
							)) ??
								(["s0", "s1", "s2"] as const).map((sk) => (
									<li key={sk} className="h-10 animate-pulse rounded bg-surface-2" />
								))}
						</ul>
					)}
				</div>

				{/* Recent Instances */}
				<div className="rounded-lg border border-border bg-surface p-4">
					<h2 className="text-sm font-medium text-fg mb-3">Recent Instances</h2>
					{recentInstances?.items.length === 0 ? (
						<p className="text-xs text-muted">No instances found.</p>
					) : (
						<ul className="space-y-2">
							{recentInstances?.items.slice(0, 5).map((inst) => (
								<li key={inst.processInstanceKey}>
									<Link
										href={`/instances/${inst.processInstanceKey}`}
										className="flex items-center justify-between hover:text-accent"
									>
										<span className="text-xs text-muted truncate mr-2">
											{inst.processDefinitionId}
										</span>
										<StatusPill state={inst.state} />
									</Link>
									{inst.startDate && (
										<p className="text-xs text-muted">{formatRelativeTime(inst.startDate)}</p>
									)}
								</li>
							)) ??
								(["s0", "s1", "s2"] as const).map((sk) => (
									<li key={sk} className="h-10 animate-pulse rounded bg-surface-2" />
								))}
						</ul>
					)}
				</div>
			</div>
		</div>
	)
}
