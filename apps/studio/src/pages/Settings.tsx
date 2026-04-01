import { Folder, Plus, Trash2 } from "lucide-react"
import { useEffect, useState } from "preact/hooks"
import { useProfiles } from "../api/queries.js"
import { ProfileTag } from "../components/ProfileTag.js"
import { ThemePicker } from "../components/ThemePicker.js"
import { Button } from "../components/ui/button.js"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../components/ui/dialog.js"
import { Input } from "../components/ui/input.js"
import { Separator } from "../components/ui/separator.js"
import { useClusterStore } from "../stores/cluster.js"
import { useProjectsStore } from "../stores/projects.js"
import { toast } from "../stores/toast.js"
import { useUiStore } from "../stores/ui.js"

export function Settings() {
	const { proxyUrl, activeProfile, setActiveProfile, setProxyUrl, loadProfiles } = useClusterStore()
	const [proxyInput, setProxyInput] = useState(proxyUrl)
	const { data: profiles, refetch } = useProfiles()
	const { setBreadcrumbs } = useUiStore()
	const { projects, activeProjectId, load, addProject, removeProject, setActiveProject } =
		useProjectsStore()

	const [addingProject, setAddingProject] = useState(false)
	const [newProjectName, setNewProjectName] = useState("")
	const [newProjectPath, setNewProjectPath] = useState("")
	const [validating, setValidating] = useState(false)

	useEffect(() => {
		setBreadcrumbs([{ label: "Settings" }])
	}, [setBreadcrumbs])

	useEffect(() => {
		void load()
	}, [load])

	function handleSaveProxy() {
		setProxyUrl(proxyInput)
		toast.success("Proxy URL saved")
		void loadProfiles()
	}

	async function handleRefreshProfiles() {
		await loadProfiles()
		await refetch()
		toast.info("Profiles refreshed")
	}

	async function handleAddProject() {
		if (!newProjectName.trim() || !newProjectPath.trim()) return
		setValidating(true)
		try {
			// Validate: try to list the tree for this path
			const res = await fetch(
				`${proxyUrl}/fs/tree?root=${encodeURIComponent(newProjectPath.trim())}`,
			)
			if (!res.ok) {
				if (res.status === 404) {
					const body = (await res.json().catch(() => null)) as { error?: string } | null
					toast.error(
						body?.error ?? "Folder not found. Check the path exists on the proxy machine.",
					)
				} else {
					toast.error(`Proxy returned an error (${res.status}). Check the proxy server logs.`)
				}
				return
			}
			await addProject(newProjectName.trim(), newProjectPath.trim())
			toast.success(`Project "${newProjectName.trim()}" added`)
			setAddingProject(false)
			setNewProjectName("")
			setNewProjectPath("")
		} catch {
			toast.error("Could not reach the proxy server. Make sure it is running.")
		} finally {
			setValidating(false)
		}
	}

	async function handleRemoveProject(id: string, name: string) {
		await removeProject(id)
		toast.success(`Removed "${name}"`)
	}

	function handleSwitchProject(id: string | null) {
		setActiveProject(id, proxyUrl)
		if (id === null) {
			toast.info("Switched to local (IndexedDB) storage")
		} else {
			const project = projects.find((p) => p.id === id)
			toast.success(`Switched to project "${project?.name}"`)
		}
	}

	return (
		<div className="p-6 max-w-2xl mx-auto">
			{/* Proxy URL */}
			<section className="mb-6">
				<h2 className="text-sm font-medium text-fg mb-1">Proxy Server</h2>
				<p className="text-xs text-muted mb-3">
					All Camunda API calls and file system access are routed through the proxy. Make sure it's
					running.
				</p>
				<div className="flex gap-2">
					<Input
						value={proxyInput}
						onInput={(e) => setProxyInput((e.target as HTMLInputElement).value)}
						placeholder="http://localhost:3033"
						aria-label="Proxy URL"
					/>
					<Button onClick={handleSaveProxy}>Save</Button>
				</div>
				<code className="mt-2 block text-xs text-muted">pnpm proxy</code>
			</section>

			<Separator className="mb-6" />

			{/* Projects */}
			<section className="mb-6">
				<div className="flex items-center justify-between mb-3">
					<div>
						<h2 className="text-sm font-medium text-fg">Projects</h2>
						<p className="text-xs text-muted">
							File system folders for storing models as files on disk
						</p>
					</div>
					<Button variant="outline" size="sm" onClick={() => setAddingProject(true)}>
						<Plus size={14} />
						Add Project
					</Button>
				</div>

				<div className="rounded-lg border border-border bg-surface overflow-hidden">
					{/* Local (IndexedDB) — always present */}
					<div className="flex items-center gap-3 px-4 py-3 border-b border-border/50">
						<div className="flex-1 min-w-0">
							<div className="font-medium text-sm text-fg">Local (IndexedDB)</div>
							<div className="text-xs text-muted">Browser storage — no file system required</div>
						</div>
						<button
							type="button"
							onClick={() => handleSwitchProject(null)}
							className={`text-xs px-2 py-0.5 rounded-full transition-colors shrink-0 ${
								activeProjectId === null ? "bg-accent/20 text-accent" : "text-muted hover:text-fg"
							}`}
							aria-pressed={activeProjectId === null}
						>
							{activeProjectId === null ? "● Active" : "Switch"}
						</button>
					</div>

					{projects.length === 0 && (
						<div className="px-4 py-3 text-sm text-muted">
							No projects configured. Add a project to store models as files on disk.
						</div>
					)}

					{projects.map((project) => (
						<div
							key={project.id}
							className="flex items-center gap-3 px-4 py-3 border-b border-border/50 last:border-0"
						>
							<Folder size={16} className="text-muted shrink-0" />
							<div className="flex-1 min-w-0">
								<div className="font-medium text-sm text-fg">{project.name}</div>
								<div className="text-xs text-muted font-mono truncate">{project.path}</div>
							</div>
							<div className="flex items-center gap-2 shrink-0">
								<button
									type="button"
									onClick={() => handleSwitchProject(project.id)}
									className={`text-xs px-2 py-0.5 rounded-full transition-colors ${
										project.id === activeProjectId
											? "bg-accent/20 text-accent"
											: "text-muted hover:text-fg"
									}`}
									aria-pressed={project.id === activeProjectId}
								>
									{project.id === activeProjectId ? "● Active" : "Switch"}
								</button>
								<Button
									variant="ghost"
									size="icon"
									onClick={() => void handleRemoveProject(project.id, project.name)}
									aria-label={`Remove project ${project.name}`}
								>
									<Trash2 size={14} />
								</Button>
							</div>
						</div>
					))}
				</div>
			</section>

			<Separator className="mb-6" />

			{/* Profiles */}
			<section className="mb-6">
				<div className="flex items-center justify-between mb-3">
					<div>
						<h2 className="text-sm font-medium text-fg">Profiles</h2>
						<p className="text-xs text-muted">Camunda cluster connections</p>
					</div>
					<Button variant="outline" size="sm" onClick={() => void handleRefreshProfiles()}>
						Refresh
					</Button>
				</div>

				{!profiles || profiles.length === 0 ? (
					<p className="text-sm text-muted">
						No profiles found. Configure profiles in your proxy config file.
					</p>
				) : (
					<div className="rounded-lg border border-border bg-surface overflow-hidden">
						<table className="w-full text-sm">
							<thead>
								<tr className="border-b border-border bg-surface-2 text-left text-xs text-muted">
									<th className="px-4 py-2 font-medium">Name</th>
									<th className="px-4 py-2 font-medium">Tags</th>
									<th className="px-4 py-2 font-medium">Type</th>
									<th className="px-4 py-2 font-medium">Active</th>
								</tr>
							</thead>
							<tbody>
								{profiles.map((p) => (
									<tr key={p.name} className="border-b border-border/50 last:border-0">
										<td className="px-4 py-2.5">
											<div className="font-medium text-fg">{p.name}</div>
											{p.description && (
												<div className="text-xs text-muted mt-0.5">{p.description}</div>
											)}
										</td>
										<td className="px-4 py-2.5">
											{p.tags && p.tags.length > 0 ? (
												<div className="flex flex-wrap gap-1">
													{p.tags.map((t) => (
														<ProfileTag key={t} tag={t} />
													))}
												</div>
											) : (
												<span className="text-xs text-muted">—</span>
											)}
										</td>
										<td className="px-4 py-2.5 text-muted text-xs">{p.apiType ?? "—"}</td>
										<td className="px-4 py-2.5">
											<button
												type="button"
												onClick={() => setActiveProfile(p.name)}
												className={`text-xs px-2 py-0.5 rounded-full transition-colors ${
													p.name === activeProfile
														? "bg-accent/20 text-accent"
														: "text-muted hover:text-fg"
												}`}
												aria-pressed={p.name === activeProfile}
											>
												{p.name === activeProfile ? "● Active" : "Set active"}
											</button>
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				)}
			</section>

			<Separator className="mb-6" />

			{/* Theme */}
			<section>
				<h2 className="text-sm font-medium text-fg mb-3">Theme</h2>
				<ThemePicker />
			</section>

			{/* Add project dialog */}
			<Dialog
				open={addingProject}
				onOpenChange={(open: boolean) => !open && setAddingProject(false)}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Add Project</DialogTitle>
					</DialogHeader>
					<div className="space-y-4 mt-4">
						<div>
							<label className="text-sm text-muted mb-1 block" htmlFor="project-name">
								Display name
							</label>
							<Input
								id="project-name"
								value={newProjectName}
								onInput={(e) => setNewProjectName((e.target as HTMLInputElement).value)}
								placeholder="My BPMN Project"
							/>
						</div>
						<div>
							<label className="text-sm text-muted mb-1 block" htmlFor="project-path">
								Absolute folder path
							</label>
							<Input
								id="project-path"
								value={newProjectPath}
								onInput={(e) => setNewProjectPath((e.target as HTMLInputElement).value)}
								placeholder="/home/user/projects/my-processes"
								className="font-mono text-xs"
							/>
							<p className="text-xs text-muted mt-1">
								Must be accessible on the machine running the proxy.
							</p>
						</div>
						<div className="flex justify-end gap-2">
							<Button
								variant="outline"
								onClick={() => {
									setAddingProject(false)
									setNewProjectName("")
									setNewProjectPath("")
								}}
							>
								Cancel
							</Button>
							<Button
								onClick={() => void handleAddProject()}
								disabled={!newProjectName.trim() || !newProjectPath.trim() || validating}
							>
								{validating ? "Validating…" : "Add Project"}
							</Button>
						</div>
					</div>
				</DialogContent>
			</Dialog>
		</div>
	)
}
