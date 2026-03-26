import { DefinitionsStore, createDefinitionDetailView } from "@bpmnkit/operate"
import { Play, RotateCw } from "lucide-react"
import { useEffect, useRef, useState } from "preact/hooks"
import { Link, useLocation, useParams } from "wouter"
import { getActiveProfile, getProxyUrl } from "../api/client.js"
import {
	useCreateProcessInstance,
	useDefinition,
	useDefinitionXml,
	useInstances,
} from "../api/queries.js"
import { Button } from "../components/ui/button.js"
import { useModelsStore } from "../stores/models.js"
import { useThemeStore } from "../stores/theme.js"
import { useUiStore } from "../stores/ui.js"

type OperateView = ReturnType<typeof createDefinitionDetailView>

// ── Wasm-native definition detail ─────────────────────────────────────────────

function WasmDefinitionDetail({ definitionKey }: { definitionKey: string }) {
	const { data: def } = useDefinition(definitionKey)
	const { data: xmlData } = useDefinitionXml(definitionKey)
	const { data: instancesData } = useInstances(
		def?.processDefinitionId ? { bpmnProcessId: def.processDefinitionId } : undefined,
	)
	const createInstance = useCreateProcessInstance()
	const { models, saveModel } = useModelsStore()
	const [variables, setVariables] = useState("{}")
	const [lastKey, setLastKey] = useState<string | null>(null)
	const [startError, setStartError] = useState<string | null>(null)
	const [, navigate] = useLocation()

	async function handleStart() {
		setStartError(null)
		setLastKey(null)
		let vars: Record<string, unknown> = {}
		try {
			const trimmed = variables.trim()
			if (trimmed && trimmed !== "{}") vars = JSON.parse(trimmed)
		} catch {
			setStartError("Variables must be valid JSON")
			return
		}
		try {
			const result = await createInstance.mutateAsync({
				processDefinitionKey: definitionKey,
				variables: vars,
			})
			setLastKey(result.processInstanceKey)
		} catch (err) {
			setStartError(err instanceof Error ? err.message : String(err))
		}
	}

	function handleOpenInEditor() {
		if (!xmlData || !def) return
		const name = def.name ?? def.processDefinitionId
		const existing = models.find((m) => m.name === name)
		if (existing) {
			navigate(`/models/${existing.id}`)
		} else {
			void saveModel({
				id: crypto.randomUUID(),
				name,
				type: "bpmn",
				content: xmlData,
				processDefinitionId: def.processDefinitionId,
				createdAt: Date.now(),
			}).then((model) => navigate(`/models/${model.id}`))
		}
	}

	const instances = instancesData?.items ?? []

	return (
		<div className="h-full overflow-y-auto p-6">
			<div className="max-w-2xl mx-auto flex flex-col gap-6">
				{/* Header */}
				<div className="flex items-start justify-between gap-4">
					<div>
						<h2 className="text-lg font-semibold text-fg">
							{def?.name ?? def?.processDefinitionId ?? definitionKey}
						</h2>
						<p className="text-sm text-muted mt-0.5">
							{def?.processDefinitionId}
							{def?.version != null && (
								<span className="ml-2 text-xs bg-surface-2 px-1.5 py-0.5 rounded">
									v{def.version}
								</span>
							)}
						</p>
					</div>
					{xmlData && (
						<Button size="sm" variant="outline" onClick={handleOpenInEditor}>
							Open in Editor
						</Button>
					)}
				</div>

				{/* Start Instance */}
				<div className="border border-border rounded-lg p-4 flex flex-col gap-3">
					<p className="text-xs font-semibold text-muted uppercase tracking-wider flex items-center gap-1.5">
						<Play size={11} />
						Start Process Instance
					</p>
					<div className="flex flex-col gap-1.5">
						<label className="text-xs text-muted" htmlFor="wasm-vars">
							Variables (JSON)
						</label>
						<textarea
							id="wasm-vars"
							value={variables}
							onInput={(e) => setVariables((e.target as HTMLTextAreaElement).value)}
							rows={4}
							className="w-full rounded-md border border-border bg-surface px-3 py-2 text-xs font-mono text-fg placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-accent resize-none"
							placeholder="{}"
						/>
					</div>
					{startError && <p className="text-xs text-danger">{startError}</p>}
					{lastKey && (
						<p className="text-xs text-success">
							Instance started —{" "}
							<Link href={`/instances/${lastKey}`} className="underline hover:text-accent">
								view #{lastKey}
							</Link>
						</p>
					)}
					<Button
						size="sm"
						onClick={() => void handleStart()}
						disabled={createInstance.isPending}
						className="self-start"
					>
						{createInstance.isPending ? (
							<>
								<RotateCw size={13} className="animate-spin" />
								Starting…
							</>
						) : (
							<>
								<Play size={13} />
								Start Instance
							</>
						)}
					</Button>
				</div>

				{/* Recent Instances */}
				<div className="flex flex-col gap-2">
					<p className="text-xs font-semibold text-muted uppercase tracking-wider">
						Process Instances
					</p>
					{instances.length === 0 ? (
						<p className="text-xs text-muted">No instances yet.</p>
					) : (
						<div className="border border-border rounded-lg overflow-hidden">
							<table className="w-full text-xs">
								<thead>
									<tr className="bg-surface-2 border-b border-border">
										<th className="px-3 py-2 text-left font-medium text-muted">Key</th>
										<th className="px-3 py-2 text-left font-medium text-muted">State</th>
										<th className="px-3 py-2 text-left font-medium text-muted">Started</th>
									</tr>
								</thead>
								<tbody>
									{instances.map((inst) => (
										<tr
											key={inst.processInstanceKey}
											className="border-b border-border last:border-0 hover:bg-surface-2 transition-colors"
										>
											<td className="px-3 py-2">
												<Link
													href={`/instances/${inst.processInstanceKey}`}
													className="text-accent hover:underline font-mono"
												>
													{inst.processInstanceKey}
												</Link>
											</td>
											<td className="px-3 py-2">
												<span
													className={
														inst.state === "ACTIVE"
															? "text-success"
															: inst.state === "COMPLETED"
																? "text-muted"
																: "text-danger"
													}
												>
													{inst.state}
												</span>
											</td>
											<td className="px-3 py-2 text-muted">
												{inst.startDate ? new Date(inst.startDate).toLocaleString() : "—"}
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					)}
				</div>
			</div>
		</div>
	)
}

// ── Main component ────────────────────────────────────────────────────────────

export function DefinitionDetail() {
	const { key } = useParams<{ key: string }>()
	const containerRef = useRef<HTMLDivElement>(null)
	const viewRef = useRef<OperateView | null>(null)
	const storeRef = useRef<DefinitionsStore | null>(null)
	const { theme } = useThemeStore()
	const [, setLocation] = useLocation()
	const { setBreadcrumbs } = useUiStore()
	const { data: definition } = useDefinition(key)
	const isWasm = getActiveProfile() === "reebe-wasm"

	useEffect(() => {
		const name = definition?.name ?? definition?.processDefinitionId ?? key
		setBreadcrumbs([{ label: "Definitions", href: "/definitions" }, { label: name }])
	}, [key, definition?.name, definition?.processDefinitionId, setBreadcrumbs])

	// biome-ignore lint/correctness/useExhaustiveDependencies: view is created once per key; refs are stable
	useEffect(() => {
		if (isWasm) return
		const container = containerRef.current
		if (!container) return

		const proxyUrl = getProxyUrl()
		const profile = getActiveProfile()

		const store = new DefinitionsStore()
		storeRef.current = store
		store.connect(proxyUrl, profile, 5000, false)

		const view = createDefinitionDetailView(
			key,
			store,
			{
				proxyUrl,
				profile,
				mock: false,
				theme: useThemeStore.getState().theme,
				navigate: (path: string) => setLocation(path),
				onOpenInEditor: (xml: string, name: string, processDefinitionId: string | undefined) => {
					const { models, saveModel } = useModelsStore.getState()
					const existing = models.find((m) => m.name === name)
					if (existing) {
						setLocation(`/models/${existing.id}`)
					} else {
						void saveModel({
							id: crypto.randomUUID(),
							name,
							type: "bpmn",
							content: xml,
							processDefinitionId,
							createdAt: Date.now(),
						}).then((model) => setLocation(`/models/${model.id}`))
					}
				},
			},
			() => setLocation("/definitions"),
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
		return <WasmDefinitionDetail definitionKey={key} />
	}

	return <div ref={containerRef} className="h-full" />
}
