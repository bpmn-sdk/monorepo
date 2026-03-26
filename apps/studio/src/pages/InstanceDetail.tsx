import { InstancesStore, createInstanceDetailView } from "@bpmnkit/operate"
import { RotateCw, XCircle } from "lucide-react"
import { useEffect, useRef } from "preact/hooks"
import { Link, useLocation, useParams } from "wouter"
import { getActiveProfile, getProxyUrl } from "../api/client.js"
import {
	useCancelInstance,
	useIncidents,
	useInstance,
	useInstanceVariables,
} from "../api/queries.js"
import { Button } from "../components/ui/button.js"
import { useModelsStore } from "../stores/models.js"
import { useThemeStore } from "../stores/theme.js"
import { toast } from "../stores/toast.js"
import { useUiStore } from "../stores/ui.js"

type OperateView = ReturnType<typeof createInstanceDetailView>

// ── Wasm-native instance detail ───────────────────────────────────────────────

function WasmInstanceDetail({ instanceKey }: { instanceKey: string }) {
	const { data: instance, isLoading } = useInstance(instanceKey)
	const { data: variablesData } = useInstanceVariables(instanceKey)
	const { data: incidentsData } = useIncidents({ processInstanceKey: instanceKey })
	const cancel = useCancelInstance()

	async function handleCancel() {
		try {
			await cancel.mutateAsync(instanceKey)
			toast.success("Instance cancelled")
		} catch (err) {
			toast.error(err instanceof Error ? err.message : String(err))
		}
	}

	const variables = variablesData?.items ?? []
	const incidents = incidentsData?.items ?? []

	if (isLoading) {
		return (
			<div className="h-full flex items-center justify-center">
				<p className="text-sm text-muted">Loading…</p>
			</div>
		)
	}

	if (!instance) {
		return (
			<div className="h-full flex items-center justify-center">
				<p className="text-sm text-muted">Instance not found.</p>
			</div>
		)
	}

	const stateColor =
		instance.state === "ACTIVE"
			? "text-success"
			: instance.state === "COMPLETED"
				? "text-muted"
				: "text-danger"

	return (
		<div className="h-full overflow-y-auto p-6">
			<div className="max-w-2xl mx-auto flex flex-col gap-6">
				{/* Header */}
				<div className="flex items-start justify-between gap-4">
					<div>
						<h2 className="text-lg font-semibold text-fg font-mono">
							{instance.processInstanceKey}
						</h2>
						<p className="text-sm text-muted mt-0.5">
							{instance.processDefinitionId}
							<span className={`ml-3 text-xs font-medium ${stateColor}`}>{instance.state}</span>
						</p>
						{instance.startDate && (
							<p className="text-xs text-muted mt-0.5">
								Started {new Date(instance.startDate).toLocaleString()}
							</p>
						)}
					</div>
					{instance.state === "ACTIVE" && (
						<Button
							size="sm"
							variant="outline"
							onClick={() => void handleCancel()}
							disabled={cancel.isPending}
							className="text-danger border-danger hover:bg-danger/10"
						>
							{cancel.isPending ? (
								<>
									<RotateCw size={13} className="animate-spin" />
									Cancelling…
								</>
							) : (
								<>
									<XCircle size={13} />
									Cancel
								</>
							)}
						</Button>
					)}
				</div>

				{/* Incidents */}
				{incidents.length > 0 && (
					<div className="flex flex-col gap-2">
						<p className="text-xs font-semibold text-muted uppercase tracking-wider">Incidents</p>
						<div className="border border-danger/40 rounded-lg overflow-hidden">
							<table className="w-full text-xs">
								<thead>
									<tr className="bg-surface-2 border-b border-border">
										<th className="px-3 py-2 text-left font-medium text-muted">Type</th>
										<th className="px-3 py-2 text-left font-medium text-muted">Element</th>
										<th className="px-3 py-2 text-left font-medium text-muted">Message</th>
										<th className="px-3 py-2 text-left font-medium text-muted">State</th>
									</tr>
								</thead>
								<tbody>
									{incidents.map((inc) => (
										<tr key={inc.incidentKey} className="border-b border-border last:border-0">
											<td className="px-3 py-2 text-danger">{inc.errorType}</td>
											<td className="px-3 py-2 font-mono text-muted">{inc.elementId}</td>
											<td className="px-3 py-2 text-muted">{inc.errorMessage || "—"}</td>
											<td className="px-3 py-2">{inc.state}</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					</div>
				)}

				{/* Variables */}
				<div className="flex flex-col gap-2">
					<p className="text-xs font-semibold text-muted uppercase tracking-wider">Variables</p>
					{variables.length === 0 ? (
						<p className="text-xs text-muted">No variables.</p>
					) : (
						<div className="border border-border rounded-lg overflow-hidden">
							<table className="w-full text-xs">
								<thead>
									<tr className="bg-surface-2 border-b border-border">
										<th className="px-3 py-2 text-left font-medium text-muted">Name</th>
										<th className="px-3 py-2 text-left font-medium text-muted">Value</th>
									</tr>
								</thead>
								<tbody>
									{variables.map((v) => (
										<tr key={v.name} className="border-b border-border last:border-0">
											<td className="px-3 py-2 font-mono text-fg">{v.name}</td>
											<td className="px-3 py-2 font-mono text-muted">{JSON.stringify(v.value)}</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					)}
				</div>

				{/* Back link */}
				<Link href="/instances" className="text-xs text-accent hover:underline self-start">
					← All instances
				</Link>
			</div>
		</div>
	)
}

// ── Main component ────────────────────────────────────────────────────────────

export function InstanceDetail() {
	const { key } = useParams<{ key: string }>()
	const containerRef = useRef<HTMLDivElement>(null)
	const viewRef = useRef<OperateView | null>(null)
	const storeRef = useRef<InstancesStore | null>(null)
	const { theme } = useThemeStore()
	const [, setLocation] = useLocation()
	const { setBreadcrumbs } = useUiStore()
	const { data: instance } = useInstance(key)
	const isWasm = getActiveProfile() === "reebe-wasm"

	useEffect(() => {
		const name = instance?.processDefinitionId ?? key
		setBreadcrumbs([{ label: "Instances", href: "/instances" }, { label: name }])
	}, [key, instance?.processDefinitionId, setBreadcrumbs])

	// biome-ignore lint/correctness/useExhaustiveDependencies: view is created once per key; refs are stable
	useEffect(() => {
		if (isWasm) return
		const container = containerRef.current
		if (!container) return

		const proxyUrl = getProxyUrl()
		const profile = getActiveProfile()

		const store = new InstancesStore()
		storeRef.current = store
		store.connect(proxyUrl, profile, 5000, false)

		const view = createInstanceDetailView(
			key,
			store,
			{
				proxyUrl,
				profile,
				interval: 5000,
				mock: false,
				theme: useThemeStore.getState().theme,
				navigate: (path: string) => setLocation(path),
				onOpenInEditor: (_xml: string, name: string) => {
					const models = useModelsStore.getState().models
					const existing = models.find((m) => m.name === name)
					if (existing) setLocation(`/models/${existing.id}`)
				},
			},
			() => setLocation("/instances"),
		)

		container.appendChild(view.el)
		viewRef.current = view

		return () => {
			view.destroy()
			store.destroy()
			viewRef.current = null
			storeRef.current = null
		}
	}, [key, isWasm])

	useEffect(() => {
		viewRef.current?.setTheme(theme)
	}, [theme])

	if (isWasm) {
		return <WasmInstanceDetail instanceKey={key} />
	}

	return <div ref={containerRef} className="h-full" />
}
