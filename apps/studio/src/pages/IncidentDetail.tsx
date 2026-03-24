import { BpmnCanvas } from "@bpmnkit/canvas"
import { createTokenHighlightPlugin } from "@bpmnkit/plugins/token-highlight"
import { AlertTriangle, ChevronLeft } from "lucide-react"
import { useEffect, useRef } from "preact/hooks"
import { Link, useParams } from "wouter"
import { useDefinitionXml, useIncident, useRetryIncident } from "../api/queries.js"
import { Button } from "../components/ui/button.js"
import { toast } from "../stores/toast.js"

export function IncidentDetail() {
	const { key } = useParams<{ key: string }>()
	const { data: incident, isLoading, isError } = useIncident(key)
	const { data: xml } = useDefinitionXml(incident?.processDefinitionKey ?? "")
	const retryMutation = useRetryIncident()
	const canvasContainerRef = useRef<HTMLDivElement>(null)
	const canvasRef = useRef<BpmnCanvas | null>(null)
	const tokenPluginRef = useRef<ReturnType<typeof createTokenHighlightPlugin> | null>(null)

	useEffect(() => {
		const container = canvasContainerRef.current
		if (!container) return
		const tokenPlugin = createTokenHighlightPlugin()
		tokenPluginRef.current = tokenPlugin
		const canvas = new BpmnCanvas({
			container,
			theme: "dark",
			grid: false,
			fit: "contain",
			plugins: [tokenPlugin],
		})
		canvasRef.current = canvas
		return () => {
			canvas.destroy()
			canvasRef.current = null
			tokenPluginRef.current = null
		}
	}, [])

	useEffect(() => {
		if (xml && canvasRef.current) {
			canvasRef.current.load(xml)
			// Highlight failing element
			if (incident?.elementId && tokenPluginRef.current) {
				tokenPluginRef.current.api.setError(incident.elementId)
			}
		}
	}, [xml, incident?.elementId])

	async function handleRetry() {
		try {
			await retryMutation.mutateAsync(key)
			toast.success("Incident resolved — job will retry")
		} catch {
			toast.error("Failed to retry incident")
		}
	}

	if (isError) {
		return (
			<div className="flex flex-col items-center justify-center h-full gap-4 p-8 text-center">
				<AlertTriangle size={32} className="text-danger" />
				<p className="text-sm text-muted">Incident not found.</p>
			</div>
		)
	}

	return (
		<div className="flex flex-col h-full">
			{/* Breadcrumb */}
			<div className="flex items-center gap-2 border-b border-border px-4 py-2 bg-surface">
				<Link href="/incidents" className="text-muted hover:text-fg" aria-label="Back to incidents">
					<ChevronLeft size={16} />
				</Link>
				<span className="text-sm text-muted">Incidents</span>
				<span className="text-muted">/</span>
				<span className="text-sm font-mono text-fg">{key}</span>
				<div className="ml-auto flex items-center gap-2">
					<Button
						variant="outline"
						size="sm"
						onClick={() => void handleRetry()}
						disabled={retryMutation.isPending}
					>
						Retry
					</Button>
				</div>
			</div>

			<div className="flex flex-1 overflow-hidden">
				{/* Canvas */}
				<div ref={canvasContainerRef} className="flex-1 overflow-hidden bg-surface-2" />

				{/* Error panel */}
				<div className="w-80 shrink-0 border-l border-border bg-surface overflow-y-auto p-4 space-y-4">
					{isLoading ? (
						<div className="space-y-2">
							{(["s0", "s1", "s2", "s3"] as const).map((sk) => (
								<div key={sk} className="h-4 animate-pulse rounded bg-surface-2" />
							))}
						</div>
					) : incident ? (
						<>
							<div>
								<p className="text-xs text-muted uppercase tracking-wider mb-1">Error Type</p>
								<p className="text-sm font-mono text-danger">{incident.errorType}</p>
							</div>
							<div>
								<p className="text-xs text-muted uppercase tracking-wider mb-1">Message</p>
								<p className="text-sm text-fg break-words">{incident.errorMessage}</p>
							</div>
							<div>
								<p className="text-xs text-muted uppercase tracking-wider mb-1">Element</p>
								<p className="text-sm font-mono text-muted">{incident.elementId}</p>
							</div>
							<div>
								<p className="text-xs text-muted uppercase tracking-wider mb-1">Links</p>
								<div className="space-y-1">
									<Link
										href={`/instances/${incident.processInstanceKey}`}
										className="block text-sm text-accent hover:underline"
									>
										View instance →
									</Link>
									<Link
										href={`/definitions/${incident.processDefinitionId}`}
										className="block text-sm text-accent hover:underline"
									>
										View definition →
									</Link>
								</div>
							</div>
							{incident.creationTime && (
								<div>
									<p className="text-xs text-muted uppercase tracking-wider mb-1">Created</p>
									<p className="text-sm text-muted">
										{new Date(incident.creationTime).toLocaleString()}
									</p>
								</div>
							)}
						</>
					) : null}
				</div>
			</div>
		</div>
	)
}
