import { AlertTriangle, ChevronLeft } from "lucide-react"
import { Link, useParams } from "wouter"
import { useDecision } from "../api/queries.js"

export function DecisionDetail() {
	const { key } = useParams<{ key: string }>()
	const { data: decision, isLoading, isError } = useDecision(key)

	if (isError) {
		return (
			<div className="flex flex-col items-center justify-center h-full gap-4 p-8 text-center">
				<AlertTriangle size={32} className="text-danger" />
				<p className="text-sm text-muted">Decision not found.</p>
			</div>
		)
	}

	return (
		<div className="flex flex-col h-full">
			<div className="flex items-center gap-2 border-b border-border px-4 py-2 bg-surface">
				<Link href="/decisions" className="text-muted hover:text-fg" aria-label="Back to decisions">
					<ChevronLeft size={16} />
				</Link>
				<span className="text-sm text-muted">Decisions</span>
				<span className="text-muted">/</span>
				<span className="text-sm font-medium text-fg">
					{isLoading ? "Loading..." : decision?.name || decision?.decisionDefinitionId}
				</span>
			</div>

			<div className="p-6 max-w-3xl">
				{isLoading ? (
					<div className="space-y-4">
						{(["s0", "s1", "s2", "s3"] as const).map((sk) => (
							<div key={sk} className="h-8 animate-pulse rounded bg-surface-2" />
						))}
					</div>
				) : decision ? (
					<div className="space-y-4">
						<h1 className="text-xl font-semibold text-fg">
							{decision.name || decision.decisionDefinitionId}
						</h1>
						<div className="rounded-lg border border-border bg-surface p-4 space-y-2 text-sm">
							<div className="flex gap-4">
								<span className="text-muted w-32">Decision ID</span>
								<span className="font-mono text-fg">{decision.decisionDefinitionId}</span>
							</div>
							<div className="flex gap-4">
								<span className="text-muted w-32">Version</span>
								<span className="text-fg">v{decision.version}</span>
							</div>
							{decision.tenantId && (
								<div className="flex gap-4">
									<span className="text-muted w-32">Tenant</span>
									<span className="text-fg">{decision.tenantId}</span>
								</div>
							)}
							<div className="flex gap-4">
								<span className="text-muted w-32">Key</span>
								<span className="font-mono text-muted text-xs">{decision.key}</span>
							</div>
						</div>
					</div>
				) : null}
			</div>
		</div>
	)
}
