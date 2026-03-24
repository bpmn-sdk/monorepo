import { BpmnEditor, initEditorHud } from "@bpmnkit/editor"
import { ChevronLeft, Link2, Save } from "lucide-react"
import { useEffect, useRef, useState } from "preact/hooks"
import { Link, useParams } from "wouter"
import { useDefinitions } from "../api/queries.js"
import { Button } from "../components/ui/button.js"
import { Input } from "../components/ui/input.js"
import { useModelsStore } from "../stores/models.js"
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
				<li key={def.processDefinitionKey} className="p-3 hover:bg-surface-2">
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
	const editorRef = useRef<BpmnEditor | null>(null)
	const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
	const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "unsaved">("saved")
	const [processIdInput, setProcessIdInput] = useState(model?.processDefinitionId ?? "")

	// Initialize editor
	// biome-ignore lint/correctness/useExhaustiveDependencies: editor is initialized once per model id; content and callbacks use refs
	useEffect(() => {
		const container = editorContainerRef.current
		if (!container || !model) return

		const editor = new BpmnEditor({ container, theme: "dark" })
		initEditorHud(editor)
		editorRef.current = editor

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
			if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
			editor.destroy()
			editorRef.current = null
		}
	}, [id])

	// ⌘S saves immediately
	// biome-ignore lint/correctness/useExhaustiveDependencies: doSave reads from refs; id/model trigger re-registration on change
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
					className={`ml-2 text-xs ${
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
				<div className="w-60 shrink-0 border-l border-border bg-surface overflow-y-auto">
					<div className="p-3 border-b border-border">
						<h2 className="text-xs font-medium text-muted uppercase tracking-wider">
							Deployed Versions
						</h2>
					</div>
					<DeployedVersionsPanel processDefinitionId={model.processDefinitionId} />

					{/* Link process ID */}
					<div className="p-3 border-t border-border">
						<p className="text-xs text-muted mb-2">
							<Link2 size={12} className="inline mr-1" />
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
