import { BpmnCanvas } from "@bpmnkit/canvas"
import { createTokenHighlightPlugin } from "@bpmnkit/plugins/token-highlight"
import { AlertTriangle, ChevronLeft, ExternalLink } from "lucide-react"
import { useEffect, useRef } from "preact/hooks"
import { Link, useParams } from "wouter"
import { useDefinition, useDefinitionXml, useIncidents, useInstances } from "../api/queries.js"
import { StatusPill } from "../components/StatusPill.js"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs.js"
import { useModelsStore } from "../stores/models.js"

export function DefinitionDetail() {
	const { key } = useParams<{ key: string }>()
	const { data: def, isLoading, isError } = useDefinition(key)
	const { data: xml } = useDefinitionXml(key)
	const { data: instances } = useInstances({ processDefinitionKey: key })
	const { data: incidents } = useIncidents({ processDefinitionKey: key })
	const { models } = useModelsStore()
	const canvasContainerRef = useRef<HTMLDivElement>(null)
	const canvasRef = useRef<BpmnCanvas | null>(null)

	const localModel = def
		? models.find((m) => m.processDefinitionId === def.processDefinitionId)
		: undefined

	// Mount canvas
	useEffect(() => {
		const container = canvasContainerRef.current
		if (!container) return

		const tokenPlugin = createTokenHighlightPlugin()
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
		}
	}, [])

	// Load XML when available
	useEffect(() => {
		if (xml && canvasRef.current) {
			canvasRef.current.load(xml)
		}
	}, [xml])

	if (isError) {
		return (
			<div className="flex flex-col items-center justify-center h-full gap-4 p-8 text-center">
				<AlertTriangle size={32} className="text-danger" />
				<p className="text-sm text-muted">Definition not found or cluster unreachable.</p>
				<Link href="/definitions" className="text-sm text-accent hover:underline">
					← Back to Definitions
				</Link>
			</div>
		)
	}

	return (
		<div className="flex flex-col h-full">
			{/* Breadcrumb */}
			<div className="flex items-center gap-2 border-b border-border px-4 py-2 bg-surface">
				<Link
					href="/definitions"
					className="text-muted hover:text-fg"
					aria-label="Back to definitions"
				>
					<ChevronLeft size={16} />
				</Link>
				<span className="text-sm text-muted">Definitions</span>
				<span className="text-muted">/</span>
				<span className="text-sm font-medium text-fg">
					{isLoading ? "Loading..." : def?.name || def?.processDefinitionId}
				</span>
			</div>

			<div className="flex flex-1 overflow-hidden">
				{/* Canvas */}
				<div ref={canvasContainerRef} className="flex-1 overflow-hidden bg-surface-2" />

				{/* Right sidebar */}
				<div className="w-64 shrink-0 border-l border-border bg-surface overflow-y-auto">
					{/* Meta */}
					{def && (
						<div className="p-3 border-b border-border space-y-1">
							<p className="text-xs text-muted font-mono">{def.processDefinitionId}</p>
							<p className="text-xs text-muted">Version {def.version}</p>
							{def.tenantId && <p className="text-xs text-muted">Tenant: {def.tenantId}</p>}
							{localModel && (
								<Link
									href={`/models/${localModel.id}`}
									className="flex items-center gap-1 text-xs text-accent hover:underline mt-2"
								>
									<ExternalLink size={11} />
									Open in editor
								</Link>
							)}
						</div>
					)}

					<Tabs defaultValue="instances">
						<TabsList className="w-full rounded-none border-b border-border bg-transparent p-0">
							<TabsTrigger value="instances" className="flex-1 rounded-none text-xs">
								Instances
								{instances && (
									<span className="ml-1 text-muted">
										({instances.page?.totalItems ?? instances.items.length})
									</span>
								)}
							</TabsTrigger>
							<TabsTrigger value="incidents" className="flex-1 rounded-none text-xs">
								Incidents
								{incidents && incidents.items.length > 0 && (
									<span className="ml-1 text-danger">({incidents.items.length})</span>
								)}
							</TabsTrigger>
						</TabsList>

						<TabsContent value="instances" className="mt-0">
							{instances?.items.length === 0 ? (
								<p className="p-3 text-xs text-muted">No instances.</p>
							) : (
								<ul className="divide-y divide-border">
									{instances?.items.slice(0, 10).map((inst) => (
										<li key={inst.processInstanceKey} className="p-3 hover:bg-surface-2">
											<Link href={`/instances/${inst.processInstanceKey}`} className="block">
												<div className="flex items-center justify-between">
													<span className="text-xs font-mono text-muted truncate">
														{inst.processInstanceKey}
													</span>
													<StatusPill state={inst.state} />
												</div>
											</Link>
										</li>
									))}
								</ul>
							)}
						</TabsContent>

						<TabsContent value="incidents" className="mt-0">
							{incidents?.items.length === 0 ? (
								<p className="p-3 text-xs text-success">No incidents!</p>
							) : (
								<ul className="divide-y divide-border">
									{incidents?.items.map((inc) => (
										<li key={inc.incidentKey} className="p-3 hover:bg-surface-2">
											<Link href={`/incidents/${inc.incidentKey}`} className="block">
												<p className="text-xs text-danger">{inc.errorType}</p>
												<p className="text-xs text-muted truncate">
													{inc.errorMessage.slice(0, 60)}
												</p>
											</Link>
										</li>
									))}
								</ul>
							)}
						</TabsContent>
					</Tabs>
				</div>
			</div>
		</div>
	)
}
