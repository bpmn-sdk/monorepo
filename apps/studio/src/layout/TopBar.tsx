import { FlaskConical, FolderOpen, MessageSquare } from "lucide-react"
import { Link } from "wouter"
import { BpmnkitLogo } from "../components/Logo.js"
import { ModeToggle } from "../components/ModeToggle.js"
import { useClusterStore } from "../stores/cluster.js"
import { useProjectsStore } from "../stores/projects.js"
import { useUiStore } from "../stores/ui.js"

export function TopBar() {
	const { aiOpen, toggleAI, toggleSidebar, breadcrumbs } = useUiStore()
	const { activeProjectId, projects } = useProjectsStore()
	const activeProject = activeProjectId ? projects.find((p) => p.id === activeProjectId) : null
	const { activeProfile, simulationMode, setSimulationMode } = useClusterStore()

	return (
		<header className="flex h-12 shrink-0 items-center gap-3 border-b border-border bg-surface px-3">
			{/* Logo — click to toggle sidebar */}
			<button
				type="button"
				onClick={toggleSidebar}
				className="flex items-center gap-2 shrink-0 rounded hover:opacity-80 active:opacity-60 transition-opacity duration-150"
				aria-label="Toggle sidebar"
				title="Toggle sidebar ["
			>
				<BpmnkitLogo height={30} />
				<span className="text-sm font-semibold text-fg">Studio</span>
			</button>

			{/* Breadcrumb */}
			{breadcrumbs.length > 0 && (
				<nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm min-w-0">
					<span className="text-border" aria-hidden="true">
						/
					</span>
					{breadcrumbs.map((crumb, i) => {
						const isLast = i === breadcrumbs.length - 1
						return (
							<span key={crumb.label} className="flex items-center gap-1.5 min-w-0">
								{crumb.href && !isLast ? (
									<Link
										href={crumb.href}
										className="text-muted hover:text-fg transition-colors duration-100 truncate"
									>
										{crumb.label}
									</Link>
								) : (
									<span className={`truncate ${isLast ? "text-fg font-medium" : "text-muted"}`}>
										{crumb.label}
									</span>
								)}
								{!isLast && (
									<span className="text-border shrink-0" aria-hidden="true">
										/
									</span>
								)}
							</span>
						)
					})}
				</nav>
			)}

			{activeProject && (
				<Link
					href="/settings"
					className="hidden sm:flex items-center gap-1.5 ml-4 px-2 py-1 rounded text-xs text-muted hover:text-fg hover:bg-surface-2 transition-colors"
					title={`Project: ${activeProject.path}`}
				>
					<FolderOpen size={13} />
					<span className="max-w-48 truncate">{activeProject.name}</span>
				</Link>
			)}

			<div className="ml-auto flex items-center gap-2">
				{activeProfile === "reebe-wasm" && (
					<button
						type="button"
						onClick={() => setSimulationMode(!simulationMode)}
						className={`flex h-8 items-center gap-1.5 rounded border px-2 text-xs transition-colors active:opacity-70 ${
							simulationMode
								? "border-warn bg-warn/10 text-warn"
								: "border-border text-muted hover:text-fg"
						}`}
						aria-label="Toggle simulation mode"
						aria-pressed={simulationMode}
						title="Simulation Mode: auto-complete service tasks instead of creating incidents"
					>
						<FlaskConical size={14} />
						<span>Simulate</span>
					</button>
				)}
				<ModeToggle />
				<button
					type="button"
					onClick={toggleAI}
					className={`flex h-8 w-8 items-center justify-center rounded border transition-colors active:opacity-70 ${
						aiOpen
							? "border-accent bg-accent/10 text-accent"
							: "border-border text-muted hover:text-fg"
					}`}
					aria-label="Toggle AI assistant"
					aria-pressed={aiOpen}
				>
					<MessageSquare size={16} />
				</button>
			</div>
		</header>
	)
}
