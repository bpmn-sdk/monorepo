import type { CanvasPlugin } from "@bpmnkit/canvas"
import { BpmnEditor, initEditorHud } from "@bpmnkit/editor"
import { createConfigPanelPlugin } from "@bpmnkit/plugins/config-panel"
import { createConfigPanelBpmnPlugin } from "@bpmnkit/plugins/config-panel-bpmn"
import { ChevronLeft, Link2, MousePointerClick, Save } from "lucide-react"
import { useEffect, useRef, useState } from "preact/hooks"
import { Link, useParams } from "wouter"
import { useDefinitions } from "../api/queries.js"
import { Button } from "../components/ui/button.js"
import { Input } from "../components/ui/input.js"
import { useModelsStore } from "../stores/models.js"
import { useThemeStore } from "../stores/theme.js"
import { toast } from "../stores/toast.js"

function DeployedVersionsPanel({ processDefinitionId }: { processDefinitionId?: string }) {
	const { data } = useDefinitions(
		processDefinitionId ? { bpmnProcessId: processDefinitionId } : undefined,
	)

	if (!processDefinitionId) {
		return (
			<p className="text-xs text-muted p-3">
				Link this model to a process ID to see deployed versions.
			</p>
		)
	}

	if (!data?.items.length) {
		return (
			<div className="p-3">
				<p className="text-xs text-muted">No deployed versions found.</p>
			</div>
		)
	}

	return (
		<ul className="divide-y divide-border">
			{data.items.map((def) => (
				<li key={def.processDefinitionKey} className="p-3 hover:bg-surface-2 transition-colors">
					<Link
						href={`/definitions/${def.processDefinitionKey}`}
						className="flex items-center justify-between text-sm hover:text-accent"
					>
						<span className="text-fg">v{def.version}</span>
						<span className="text-xs text-muted">
							{def.deploymentTime ? new Date(def.deploymentTime).toLocaleDateString() : ""}
						</span>
					</Link>
				</li>
			))}
		</ul>
	)
}

export function ModelDetail() {
	const { id } = useParams<{ id: string }>()
	const { models, saveModel, upsertModel } = useModelsStore()
	const model = models.find((m) => m.id === id)
	const editorContainerRef = useRef<HTMLDivElement>(null)
	const propertiesPaneRef = useRef<HTMLDivElement>(null)
	const editorRef = useRef<BpmnEditor | null>(null)
	const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
	const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "unsaved">("saved")
	const [processIdInput, setProcessIdInput] = useState(model?.processDefinitionId ?? "")
	const [showPropsPlaceholder, setShowPropsPlaceholder] = useState(true)
	const { theme } = useThemeStore()

	// Initialize editor
	// biome-ignore lint/correctness/useExhaustiveDependencies: editor created once per id; refs handle the rest
	useEffect(() => {
		const container = editorContainerRef.current
		const propsPane = propertiesPaneRef.current
		if (!container || !propsPane || !model) return

		// Config panel — renders into the right panel's properties section
		const configPanel = createConfigPanelPlugin({
			getDefinitions: () => editorRef.current?.getDefinitions() ?? null,
			applyChange: (fn) => {
				editorRef.current?.applyChange(fn)
			},
			container: propsPane,
			onPanelShow: () => setShowPropsPlaceholder(false),
			onPanelHide: () => setShowPropsPlaceholder(true),
		})
		const configPanelBpmn = createConfigPanelBpmnPlugin(configPanel)

		// Bridge: wire element:click → editor:select for the config panel to activate
		const bridgePlugin: CanvasPlugin = {
			name: "studio-config-bridge",
			install(api) {
				type AnyEmit = (event: string, ...args: unknown[]) => void
				const emit = api.emit.bind(api) as unknown as AnyEmit
				api.on("element:click", (elId) => emit("editor:select", [elId]))
			},
		}

		const editor = new BpmnEditor({
			container,
			theme: useThemeStore.getState().theme,
			plugins: [bridgePlugin, configPanel, configPanelBpmn],
		})
		initEditorHud(editor)
		editorRef.current = editor

		// Set zoom to 100% after diagram loads
		const offLoad = editor.on("diagram:load", () => {
			editor.setZoom(1)
		})

		if (model.content) {
			editor.load(model.content)
		}

		const off = editor.on("diagram:change", () => {
			setSaveStatus("unsaved")
			if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
			saveTimerRef.current = setTimeout(() => {
				void doSave()
			}, 2000)
		})

		return () => {
			off()
			offLoad()
			if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
			editor.destroy()
			editorRef.current = null
		}
	}, [id])

	// Sync editor theme on change
	useEffect(() => {
		editorRef.current?.setTheme(theme)
	}, [theme])

	// ⌘S saves immediately
	// biome-ignore lint/correctness/useExhaustiveDependencies: doSave reads from refs; id/model trigger re-registration
	useEffect(() => {
		function handleKeyDown(e: KeyboardEvent) {
			if ((e.metaKey || e.ctrlKey) && e.key === "s") {
				e.preventDefault()
				void doSave()
			}
		}
		window.addEventListener("keydown", handleKeyDown)
		return () => window.removeEventListener("keydown", handleKeyDown)
	}, [id, model])

	async function doSave() {
		const editor = editorRef.current
		if (!editor || !model) return
		const xml = editor.exportXml()
		if (!xml) return
		setSaveStatus("saving")
		try {
			const updated = await saveModel({ ...model, content: xml })
			upsertModel(updated)
			setSaveStatus("saved")
		} catch {
			setSaveStatus("unsaved")
			toast.error("Failed to save model")
		}
	}

	async function handleLinkProcessId() {
		if (!model) return
		const updated = await saveModel({ ...model, processDefinitionId: processIdInput || undefined })
		upsertModel(updated)
		toast.success("Process ID linked")
	}

	if (!model) {
		return (
			<div className="flex flex-col items-center justify-center h-full gap-4 text-center p-8">
				<p className="text-lg font-medium text-fg">Model not found</p>
				<Link href="/models" className="text-sm text-accent hover:underline">
					← Back to Models
				</Link>
			</div>
		)
	}

	return (
		<div className="flex flex-col h-full">
			{/* Breadcrumb / toolbar */}
			<div className="flex items-center gap-3 border-b border-border px-4 py-2 bg-surface">
				<Link href="/models" className="text-muted hover:text-fg" aria-label="Back to models">
					<ChevronLeft size={16} />
				</Link>
				<span className="text-sm text-muted">Models</span>
				<span className="text-muted">/</span>
				<span className="text-sm font-medium text-fg">{model.name}</span>
				<span
					className={`ml-2 text-xs transition-colors ${
						saveStatus === "saved"
							? "text-success"
							: saveStatus === "saving"
								? "text-warn"
								: "text-muted"
					}`}
				>
					{saveStatus === "saved" ? "Saved" : saveStatus === "saving" ? "Saving…" : "Unsaved"}
				</span>
				<div className="ml-auto flex items-center gap-2">
					<Button size="sm" variant="ghost" onClick={() => void doSave()}>
						<Save size={14} />
						Save
					</Button>
				</div>
			</div>

			{/* Main area */}
			<div className="flex flex-1 overflow-hidden">
				{/* Editor */}
				<div ref={editorContainerRef} className="flex-1 overflow-hidden relative" />

				{/* Right panel */}
				<div className="w-64 shrink-0 border-l border-border bg-surface flex flex-col overflow-hidden">
					{/* Properties section */}
					<div className="border-b border-border">
						<div className="px-3 py-2 border-b border-border/50">
							<h2 className="text-xs font-medium text-muted uppercase tracking-wider">
								Properties
							</h2>
						</div>
						<div className="relative">
							{/* Config panel renders here */}
							<div ref={propertiesPaneRef} />
							{showPropsPlaceholder && (
								<div className="flex flex-col items-center gap-2 py-6 px-3 text-center">
									<MousePointerClick size={18} className="text-muted/50" />
									<p className="text-xs text-muted">Click an element to edit</p>
								</div>
							)}
						</div>
					</div>

					{/* Deployed versions */}
					<div className="border-b border-border flex-shrink-0">
						<div className="px-3 py-2 border-b border-border/50">
							<h2 className="text-xs font-medium text-muted uppercase tracking-wider">
								Deployed Versions
							</h2>
						</div>
						<DeployedVersionsPanel processDefinitionId={model.processDefinitionId} />
					</div>

					{/* Link process ID */}
					<div className="p-3 mt-auto">
						<p className="text-xs text-muted mb-2 flex items-center gap-1">
							<Link2 size={11} />
							Link to Process ID
						</p>
						<div className="flex gap-1">
							<Input
								value={processIdInput}
								onInput={(e) => setProcessIdInput((e.target as HTMLInputElement).value)}
								placeholder="process-id"
								className="text-xs h-7"
								aria-label="Process definition ID"
							/>
							<Button size="sm" variant="outline" onClick={() => void handleLinkProcessId()}>
								Link
							</Button>
						</div>
					</div>
				</div>
			</div>
		</div>
	)
}
