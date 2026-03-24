import { BpmnCanvas } from "@bpmnkit/canvas"
import { createTokenHighlightPlugin } from "@bpmnkit/plugins/token-highlight"
import { AlertTriangle, ChevronLeft } from "lucide-react"
import { useEffect, useRef } from "preact/hooks"
import { useState } from "preact/hooks"
import { Link, useParams } from "wouter"
import {
	useCancelInstance,
	useDefinitionXml,
	useIncidents,
	useInstance,
	useInstanceVariables,
} from "../api/queries.js"
import { StatusPill } from "../components/StatusPill.js"
import { Button } from "../components/ui/button.js"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../components/ui/dialog.js"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs.js"
import { toast } from "../stores/toast.js"

function VariableTree({ value, depth = 0 }: { value: unknown; depth?: number }) {
	const [expanded, setExpanded] = useState(depth < 2)
	if (value === null) return <span className="text-muted">null</span>
	if (typeof value === "object" && !Array.isArray(value)) {
		const entries = Object.entries(value as Record<string, unknown>)
		return (
			<div>
				<button
					type="button"
					onClick={() => setExpanded((e) => !e)}
					className="text-muted text-xs mr-1"
				>
					{expanded ? "▼" : "▶"}
				</button>
				<span className="text-muted text-xs">{"{"}</span>
				{expanded && (
					<div className="pl-4">
						{entries.map(([k, v]) => (
							<div key={k} className="flex gap-2 text-xs">
								<span className="text-accent-bright">{k}</span>
								<span className="text-muted">:</span>
								<VariableTree value={v} depth={depth + 1} />
							</div>
						))}
					</div>
				)}
				<span className="text-muted text-xs">{"}"}</span>
			</div>
		)
	}
	if (typeof value === "string") return <span className="text-teal">"{value}"</span>
	if (typeof value === "number" || typeof value === "boolean")
		return <span className="text-warn">{String(value)}</span>
	return <span className="text-fg text-xs">{String(value)}</span>
}

export function InstanceDetail() {
	const { key } = useParams<{ key: string }>()
	const { data: instance, isLoading, isError } = useInstance(key)
	const { data: variables } = useInstanceVariables(key)
	const { data: incidents } = useIncidents({ processInstanceKey: key })
	const { data: xml } = useDefinitionXml(instance?.processDefinitionKey ?? "")
	const cancelMutation = useCancelInstance()
	const canvasContainerRef = useRef<HTMLDivElement>(null)
	const canvasRef = useRef<BpmnCanvas | null>(null)
	const [confirmCancel, setConfirmCancel] = useState(false)

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

	// Load XML
	useEffect(() => {
		if (xml && canvasRef.current) {
			canvasRef.current.load(xml)
		}
	}, [xml])

	async function handleCancel() {
		try {
			await cancelMutation.mutateAsync(key)
			toast.success("Instance cancelled")
			setConfirmCancel(false)
		} catch {
			toast.error("Failed to cancel instance")
		}
	}

	if (isError) {
		return (
			<div className="flex flex-col items-center justify-center h-full gap-4 p-8 text-center">
				<AlertTriangle size={32} className="text-danger" />
				<p className="text-sm text-muted">Instance not found.</p>
			</div>
		)
	}

	return (
		<div className="flex flex-col h-full">
			{/* Breadcrumb */}
			<div className="flex items-center gap-2 border-b border-border px-4 py-2 bg-surface">
				<Link href="/instances" className="text-muted hover:text-fg" aria-label="Back to instances">
					<ChevronLeft size={16} />
				</Link>
				<span className="text-sm text-muted">Instances</span>
				<span className="text-muted">/</span>
				<span className="text-sm font-mono text-fg">{key}</span>
				{instance && (
					<span className="ml-2">
						<StatusPill state={instance.state} />
					</span>
				)}
				<div className="ml-auto flex items-center gap-2">
					{instance?.processDefinitionKey && (
						<Link
							href={`/definitions/${instance.processDefinitionKey}`}
							className="text-xs text-accent hover:underline"
						>
							View definition →
						</Link>
					)}
					{instance?.state === "ACTIVE" && (
						<Button variant="danger" size="sm" onClick={() => setConfirmCancel(true)}>
							Cancel Instance
						</Button>
					)}
				</div>
			</div>

			<div className="flex flex-1 overflow-hidden">
				{/* Canvas */}
				<div ref={canvasContainerRef} className="flex-1 overflow-hidden bg-surface-2" />

				{/* Right panel */}
				<div className="w-72 shrink-0 border-l border-border bg-surface overflow-y-auto">
					<Tabs defaultValue="variables">
						<TabsList className="w-full rounded-none border-b border-border bg-transparent p-0">
							<TabsTrigger value="variables" className="flex-1 rounded-none text-xs">
								Variables
							</TabsTrigger>
							<TabsTrigger value="incidents" className="flex-1 rounded-none text-xs">
								Incidents
								{incidents && incidents.items.length > 0 && (
									<span className="ml-1 text-danger">({incidents.items.length})</span>
								)}
							</TabsTrigger>
						</TabsList>

						<TabsContent value="variables" className="mt-0 p-3 font-mono text-xs">
							{!variables || variables.items.length === 0 ? (
								<p className="text-muted">No variables.</p>
							) : (
								variables.items.map((v) => (
									<div key={v.name} className="mb-2">
										<span className="text-accent-bright">{v.name}</span>
										<span className="text-muted"> = </span>
										<VariableTree value={v.value} />
									</div>
								))
							)}
						</TabsContent>

						<TabsContent value="incidents" className="mt-0">
							{incidents?.items.length === 0 ? (
								<p className="p-3 text-xs text-success">No incidents!</p>
							) : (
								<ul className="divide-y divide-border">
									{incidents?.items.map((inc) => (
										<li key={inc.incidentKey} className="p-3">
											<Link href={`/incidents/${inc.incidentKey}`}>
												<p className="text-xs text-danger">{inc.errorType}</p>
												<p className="text-xs text-muted truncate">
													{inc.errorMessage.slice(0, 80)}
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

			{/* Cancel confirmation */}
			<Dialog
				open={confirmCancel}
				onOpenChange={(open: boolean) => !open && setConfirmCancel(false)}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Cancel Instance</DialogTitle>
					</DialogHeader>
					<p className="text-sm text-muted mt-2">
						Are you sure you want to cancel instance{" "}
						<strong className="text-fg font-mono">{key}</strong>?
					</p>
					<div className="flex justify-end gap-2 mt-4">
						<Button variant="outline" onClick={() => setConfirmCancel(false)}>
							Keep
						</Button>
						<Button variant="danger" onClick={() => void handleCancel()}>
							Cancel Instance
						</Button>
					</div>
				</DialogContent>
			</Dialog>

			{isLoading && (
				<div className="absolute inset-0 flex items-center justify-center bg-bg/80">
					<div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
				</div>
			)}
		</div>
	)
}
