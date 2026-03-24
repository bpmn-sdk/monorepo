import { Bpmn, Dmn, Form } from "@bpmnkit/core"
import { FileText, Grid, List, Plus, Trash2, Upload } from "lucide-react"
import { useRef, useState } from "preact/hooks"
import { useLocation } from "wouter"
import { DiagramPreview } from "../components/DiagramPreview.js"
import { StatusPill } from "../components/StatusPill.js"
import { Button } from "../components/ui/button.js"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../components/ui/dialog.js"
import { Input } from "../components/ui/input.js"
import type { ModelFile } from "../storage/types.js"
import { useModelsStore } from "../stores/models.js"
import { toast } from "../stores/toast.js"

type ModelType = "bpmn" | "dmn" | "form"
type ViewMode = "grid" | "list"

const TYPE_LABELS: Record<ModelType, string> = {
	bpmn: "BPMN",
	dmn: "DMN",
	form: "Form",
}

function makeEmptyContent(type: ModelType, name: string): string {
	const id = name.toLowerCase().replace(/[^a-z0-9]/g, "-")
	if (type === "bpmn") return Bpmn.makeEmpty(id, name)
	if (type === "dmn") return Dmn.export(Dmn.makeEmpty())
	return Form.export(Form.makeEmpty(id))
}

function ProcessCard({ model, onDelete }: { model: ModelFile; onDelete: () => void }) {
	const [, navigate] = useLocation()
	const [hovered, setHovered] = useState(false)

	return (
		<article
			className="relative rounded-lg border border-border bg-surface overflow-hidden hover:border-accent hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200"
			onMouseEnter={() => setHovered(true)}
			onMouseLeave={() => setHovered(false)}
			aria-label={`Model: ${model.name}`}
		>
			<div className="h-36 bg-surface-2">
				<DiagramPreview xml={model.content} width={220} height={144} />
			</div>
			<div className="p-3">
				<div className="flex items-center justify-between gap-2">
					<span className="text-sm font-medium text-fg truncate">{model.name}</span>
					<span className="text-xs rounded bg-surface-2 px-1.5 py-0.5 text-muted shrink-0">
						{TYPE_LABELS[model.type]}
					</span>
				</div>
				<p className="text-xs text-muted mt-1">{new Date(model.updatedAt).toLocaleDateString()}</p>
			</div>
			{hovered && (
				<div className="absolute inset-0 flex items-center justify-center gap-2 bg-bg/70 animate-in fade-in duration-150">
					<Button
						size="sm"
						onClick={(e) => {
							e.stopPropagation()
							navigate(`/models/${model.id}`)
						}}
					>
						Open
					</Button>
					<Button
						size="sm"
						variant="danger"
						onClick={(e) => {
							e.stopPropagation()
							onDelete()
						}}
						aria-label={`Delete ${model.name}`}
					>
						<Trash2 size={14} />
					</Button>
				</div>
			)}
		</article>
	)
}

export function Models() {
	const { models, saveModel, deleteModel } = useModelsStore()
	const [, navigate] = useLocation()
	const [search, setSearch] = useState("")
	const [typeFilter, setTypeFilter] = useState<ModelType | "all">("all")
	const [viewMode, setViewMode] = useState<ViewMode>("grid")
	const [creating, setCreating] = useState(false)
	const [newName, setNewName] = useState("")
	const [newType, setNewType] = useState<ModelType>("bpmn")
	const [confirmDelete, setConfirmDelete] = useState<ModelFile | null>(null)
	const fileInputRef = useRef<HTMLInputElement>(null)

	const filtered = models.filter((m) => {
		if (typeFilter !== "all" && m.type !== typeFilter) return false
		if (search && !m.name.toLowerCase().includes(search.toLowerCase())) return false
		return true
	})

	async function handleCreate() {
		if (!newName.trim()) return
		const content = makeEmptyContent(newType, newName.trim())
		const model = await saveModel({
			id: crypto.randomUUID(),
			name: newName.trim(),
			type: newType,
			content,
			createdAt: Date.now(),
		})
		setCreating(false)
		setNewName("")
		navigate(`/models/${model.id}`)
	}

	async function handleImport(files: FileList | null) {
		if (!files) return
		for (const file of Array.from(files)) {
			const ext = file.name.split(".").pop()?.toLowerCase()
			const type: ModelType = ext === "bpmn" ? "bpmn" : ext === "dmn" ? "dmn" : "form"
			const content = await file.text()
			const name = file.name.replace(/\.[^.]+$/, "")
			await saveModel({
				id: crypto.randomUUID(),
				name,
				type,
				content,
				createdAt: Date.now(),
			})
			toast.success(`Imported ${name}`)
		}
	}

	async function handleDelete(model: ModelFile) {
		await deleteModel(model.id)
		setConfirmDelete(null)
		toast.success(`Deleted ${model.name}`)
	}

	// Drag and drop
	function handleDrop(e: DragEvent) {
		e.preventDefault()
		void handleImport(e.dataTransfer?.files ?? null)
	}

	return (
		<div
			className="p-6 max-w-6xl mx-auto animate-in fade-in slide-in-from-bottom-2 duration-300"
			onDragOver={(e) => e.preventDefault()}
			onDrop={handleDrop}
		>
			{/* Header */}
			<div className="flex items-center justify-between mb-6">
				<h1 className="text-xl font-semibold text-fg">Models</h1>
				<div className="flex items-center gap-2">
					<Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
						<Upload size={14} />
						Import
					</Button>
					<Button size="sm" onClick={() => setCreating(true)}>
						<Plus size={14} />
						New Model
					</Button>
					<input
						ref={fileInputRef}
						type="file"
						accept=".bpmn,.dmn,.form,.json"
						multiple
						className="hidden"
						onChange={(e) => void handleImport((e.target as HTMLInputElement).files)}
						aria-label="Import model files"
					/>
				</div>
			</div>

			{/* Filters */}
			<div className="flex items-center gap-3 mb-4">
				<Input
					placeholder="Search models..."
					value={search}
					onInput={(e) => setSearch((e.target as HTMLInputElement).value)}
					className="max-w-64"
					aria-label="Search models"
				/>
				<div className="flex rounded border border-border bg-surface-2 text-xs overflow-hidden">
					{(["all", "bpmn", "dmn", "form"] as const).map((t) => (
						<button
							key={t}
							type="button"
							onClick={() => setTypeFilter(t)}
							className={`px-3 py-1.5 capitalize transition-colors ${
								typeFilter === t ? "bg-surface text-fg" : "text-muted hover:text-fg"
							}`}
							aria-pressed={typeFilter === t}
						>
							{t === "all" ? "All" : TYPE_LABELS[t]}
						</button>
					))}
				</div>
				<div className="ml-auto flex gap-1">
					<button
						type="button"
						onClick={() => setViewMode("grid")}
						className={`p-1.5 rounded ${viewMode === "grid" ? "text-fg" : "text-muted hover:text-fg"}`}
						aria-label="Grid view"
						aria-pressed={viewMode === "grid"}
					>
						<Grid size={16} />
					</button>
					<button
						type="button"
						onClick={() => setViewMode("list")}
						className={`p-1.5 rounded ${viewMode === "list" ? "text-fg" : "text-muted hover:text-fg"}`}
						aria-label="List view"
						aria-pressed={viewMode === "list"}
					>
						<List size={16} />
					</button>
				</div>
			</div>

			{/* Content */}
			{filtered.length === 0 ? (
				<div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
					<FileText size={40} className="text-muted" />
					<div>
						<p className="text-base font-medium text-fg">No models yet</p>
						<p className="text-sm text-muted mt-1">
							Create your first model or import an existing file.
						</p>
					</div>
					<Button onClick={() => setCreating(true)}>
						<Plus size={14} />
						Create model
					</Button>
				</div>
			) : viewMode === "grid" ? (
				<div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
					{filtered.map((model) => (
						<ProcessCard key={model.id} model={model} onDelete={() => setConfirmDelete(model)} />
					))}
				</div>
			) : (
				<table className="w-full text-sm">
					<thead>
						<tr className="border-b border-border text-left text-xs text-muted">
							<th className="pb-2 font-medium">Name</th>
							<th className="pb-2 font-medium">Type</th>
							<th className="pb-2 font-medium">Process ID</th>
							<th className="pb-2 font-medium">Modified</th>
							<th className="pb-2 font-medium sr-only">Actions</th>
						</tr>
					</thead>
					<tbody>
						{filtered.map((model) => (
							<tr
								key={model.id}
								className="border-b border-border/50 hover:bg-surface-2 cursor-pointer"
								onClick={() => navigate(`/models/${model.id}`)}
								onKeyDown={(e) => e.key === "Enter" && navigate(`/models/${model.id}`)}
							>
								<td className="py-2.5 pr-4 font-medium text-fg">{model.name}</td>
								<td className="py-2.5 pr-4">
									<StatusPill state={TYPE_LABELS[model.type]} />
								</td>
								<td className="py-2.5 pr-4 text-muted font-mono text-xs">
									{model.processDefinitionId ?? "—"}
								</td>
								<td className="py-2.5 pr-4 text-muted">
									{new Date(model.updatedAt).toLocaleDateString()}
								</td>
								<td className="py-2.5">
									<Button
										variant="ghost"
										size="icon"
										onClick={(e) => {
											e.stopPropagation()
											setConfirmDelete(model)
										}}
										aria-label={`Delete ${model.name}`}
									>
										<Trash2 size={14} />
									</Button>
								</td>
							</tr>
						))}
					</tbody>
				</table>
			)}

			{/* Create dialog */}
			<Dialog open={creating} onOpenChange={(open: boolean) => !open && setCreating(false)}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>New Model</DialogTitle>
					</DialogHeader>
					<div className="space-y-4 mt-4">
						<div>
							<label className="text-sm text-muted mb-1 block" htmlFor="model-name">
								Name
							</label>
							<Input
								id="model-name"
								value={newName}
								onInput={(e) => setNewName((e.target as HTMLInputElement).value)}
								placeholder="My Process"
								onKeyDown={(e) => e.key === "Enter" && void handleCreate()}
							/>
						</div>
						<div>
							<p className="text-sm text-muted mb-2">Type</p>
							<div className="grid grid-cols-3 gap-2">
								{(["bpmn", "dmn", "form"] as const).map((t) => (
									<button
										key={t}
										type="button"
										onClick={() => setNewType(t)}
										className={`rounded border p-3 text-center text-sm transition-colors ${
											newType === t
												? "border-accent bg-accent/10 text-accent"
												: "border-border text-fg hover:bg-surface-2"
										}`}
										aria-pressed={newType === t}
									>
										{TYPE_LABELS[t]}
									</button>
								))}
							</div>
						</div>
						<div className="flex justify-end gap-2">
							<Button variant="outline" onClick={() => setCreating(false)}>
								Cancel
							</Button>
							<Button onClick={() => void handleCreate()} disabled={!newName.trim()}>
								Create
							</Button>
						</div>
					</div>
				</DialogContent>
			</Dialog>

			{/* Delete confirmation */}
			<Dialog
				open={!!confirmDelete}
				onOpenChange={(open: boolean) => !open && setConfirmDelete(null)}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Delete Model</DialogTitle>
					</DialogHeader>
					<p className="text-sm text-muted mt-2">
						Are you sure you want to delete{" "}
						<strong className="text-fg">{confirmDelete?.name}</strong>? This cannot be undone.
					</p>
					<div className="flex justify-end gap-2 mt-4">
						<Button variant="outline" onClick={() => setConfirmDelete(null)}>
							Cancel
						</Button>
						<Button
							variant="danger"
							onClick={() => confirmDelete && void handleDelete(confirmDelete)}
						>
							Delete
						</Button>
					</div>
				</DialogContent>
			</Dialog>
		</div>
	)
}
