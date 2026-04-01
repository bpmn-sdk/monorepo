import {
	AlertTriangle,
	CheckSquare,
	FolderOpen,
	GitBranch,
	Layers,
	LayoutDashboard,
	PanelLeftClose,
	PanelLeftOpen,
	Play,
	RotateCw,
	Search,
	Settings,
} from "lucide-react"
import { useState } from "preact/hooks"
import { Link } from "wouter"
import { useLocation } from "wouter"
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "../components/ui/dropdown-menu.js"
import { navigateWithTransition } from "../lib/transition.js"
import { useClusterStore } from "../stores/cluster.js"
import { useModeStore } from "../stores/mode.js"
import { useProjectsStore } from "../stores/projects.js"
import { useUiStore } from "../stores/ui.js"

interface NavItem {
	icon: typeof LayoutDashboard
	label: string
	path: string
	shortcut: string
}

// Paths that require a running proxy to be useful
const PROXY_REQUIRED = new Set([
	"/",
	"/definitions",
	"/instances",
	"/incidents",
	"/tasks",
	"/decisions",
])

const ALL_ITEMS: NavItem[] = [
	{ icon: LayoutDashboard, label: "Dashboard", path: "/", shortcut: "g d" },
	{ icon: FolderOpen, label: "Models", path: "/models", shortcut: "g m" },
	{ icon: Layers, label: "Definitions", path: "/definitions", shortcut: "g e" },
	{ icon: Play, label: "Instances", path: "/instances", shortcut: "g i" },
	{ icon: AlertTriangle, label: "Incidents", path: "/incidents", shortcut: "g n" },
	{ icon: CheckSquare, label: "Tasks", path: "/tasks", shortcut: "g t" },
	{ icon: GitBranch, label: "Decisions", path: "/decisions", shortcut: "g c" },
	{ icon: Settings, label: "Settings", path: "/settings", shortcut: "g s" },
]

const DEVELOPER_ORDER = [
	"/",
	"/models",
	"/definitions",
	"/instances",
	"/incidents",
	"/tasks",
	"/decisions",
	"/settings",
]
const OPERATOR_ORDER = [
	"/",
	"/instances",
	"/incidents",
	"/tasks",
	"/definitions",
	"/decisions",
	"/models",
	"/settings",
]

function getOrderedItems(mode: "developer" | "operator"): NavItem[] {
	const order = mode === "developer" ? DEVELOPER_ORDER : OPERATOR_ORDER
	return order.flatMap((path) => ALL_ITEMS.filter((i) => i.path === path))
}

export function Sidebar() {
	const [location, navigate] = useLocation()
	const { mode } = useModeStore()
	const { profiles, activeProfile, status, setActiveProfile, loadProfiles, proxyUrl } =
		useClusterStore()
	const { projects, activeProjectId, setActiveProject } = useProjectsStore()
	const [reconnecting, setReconnecting] = useState(false)

	async function handleReconnect() {
		setReconnecting(true)
		await loadProfiles()
		setReconnecting(false)
	}
	const { sidebarExpanded, toggleSidebar, openCommandPalette } = useUiStore()
	const items = getOrderedItems(mode)

	function isActive(path: string) {
		if (path === "/") return location === "/"
		return location.startsWith(path)
	}

	const statusColor =
		status === "connected" ? "bg-success" : status === "loading" ? "bg-warn" : "bg-danger"

	return (
		<nav
			className={`flex shrink-0 flex-col bg-nav py-2 transition-[width] duration-200 ease-in-out ${
				sidebarExpanded ? "w-52 border-r border-border/40" : "w-16"
			}`}
			aria-label="Main navigation"
		>
			{/* Top: profile picker + search */}
			<div className="px-2 pb-2 mb-1 border-b border-white/10 flex flex-col gap-0.5">
				{/* Cluster / profile picker */}
				<DropdownMenu>
					<DropdownMenuTrigger
						className={`flex w-full items-center gap-2.5 rounded-md h-9 px-2.5 text-nav-fg hover:text-nav-fg-active hover:bg-white/5 transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-accent ${
							sidebarExpanded ? "justify-start" : "justify-center"
						}`}
						aria-label="Select cluster profile"
					>
						<span
							className={`h-2 w-2 shrink-0 rounded-full ${statusColor} ${status === "loading" ? "animate-pulse" : ""}`}
							aria-hidden="true"
						/>
						<span
							className={`text-sm font-medium whitespace-nowrap overflow-hidden transition-[max-width,opacity] duration-150 flex-1 text-left ${
								sidebarExpanded ? "max-w-xs opacity-100" : "max-w-0 opacity-0"
							}`}
						>
							{activeProfile ?? (status === "offline" ? "No cluster" : "Select profile")}
						</span>
						<span
							className={`text-muted text-xs transition-[max-width,opacity] duration-150 ${
								sidebarExpanded ? "max-w-xs opacity-100" : "max-w-0 opacity-0"
							}`}
						>
							▾
						</span>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="start" className="min-w-48">
						{profiles.length === 0 ? (
							<>
								<DropdownMenuLabel>No profiles found</DropdownMenuLabel>
								<DropdownMenuSeparator />
							</>
						) : (
							<>
								<DropdownMenuLabel>Profiles</DropdownMenuLabel>
								{profiles.map((p) => (
									<DropdownMenuItem
										key={p.name}
										onSelect={() => setActiveProfile(p.name)}
										className="gap-2"
									>
										{p.name === activeProfile && (
											<span className="text-accent" aria-label="Active">
												●
											</span>
										)}
										<span className={p.name === activeProfile ? "font-medium" : ""}>{p.name}</span>
									</DropdownMenuItem>
								))}
								<DropdownMenuSeparator />
							</>
						)}
						<DropdownMenuItem asChild>
							<Link href="/settings" className="cursor-pointer text-muted">
								Add profile →
							</Link>
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>

				{/* Project picker */}
				<DropdownMenu>
					<DropdownMenuTrigger
						className={`flex w-full items-center gap-2.5 rounded-md h-9 px-2.5 text-nav-fg hover:text-nav-fg-active hover:bg-white/5 transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-accent ${
							sidebarExpanded ? "justify-start" : "justify-center"
						}`}
						aria-label="Select project"
					>
						<FolderOpen size={18} className="shrink-0" />
						<span
							className={`text-sm font-medium whitespace-nowrap overflow-hidden transition-[max-width,opacity] duration-150 flex-1 text-left ${
								sidebarExpanded ? "max-w-xs opacity-100" : "max-w-0 opacity-0"
							}`}
						>
							{activeProjectId
								? (projects.find((p) => p.id === activeProjectId)?.name ?? "Unknown project")
								: "Local (IndexedDB)"}
						</span>
						<span
							className={`text-muted text-xs transition-[max-width,opacity] duration-150 ${
								sidebarExpanded ? "max-w-xs opacity-100" : "max-w-0 opacity-0"
							}`}
						>
							▾
						</span>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="start" className="min-w-48">
						<DropdownMenuLabel>Projects</DropdownMenuLabel>
						<DropdownMenuItem onSelect={() => setActiveProject(null, proxyUrl)} className="gap-2">
							{activeProjectId === null && <span className="text-accent">●</span>}
							<span className={activeProjectId === null ? "font-medium" : ""}>
								Local (IndexedDB)
							</span>
						</DropdownMenuItem>
						{projects.map((p) => (
							<DropdownMenuItem
								key={p.id}
								onSelect={() => setActiveProject(p.id, proxyUrl)}
								className="gap-2"
							>
								{p.id === activeProjectId && <span className="text-accent">●</span>}
								<span className={p.id === activeProjectId ? "font-medium" : ""}>{p.name}</span>
							</DropdownMenuItem>
						))}
						<DropdownMenuSeparator />
						<DropdownMenuItem asChild>
							<Link href="/settings" className="cursor-pointer text-muted">
								Manage projects →
							</Link>
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>

				{/* Reconnect button — visible when proxy is offline */}
				{status === "offline" && (
					<div className="group relative">
						<button
							type="button"
							onClick={() => void handleReconnect()}
							disabled={reconnecting}
							className={`flex w-full items-center gap-2.5 rounded-md h-9 px-2.5 text-warn hover:text-warn/80 hover:bg-white/5 transition-colors duration-150 disabled:opacity-50 ${
								sidebarExpanded ? "justify-start" : "justify-center"
							}`}
							aria-label="Retry proxy connection"
						>
							<RotateCw size={18} className={`shrink-0 ${reconnecting ? "animate-spin" : ""}`} />
							<span
								className={`text-sm whitespace-nowrap overflow-hidden transition-[max-width,opacity] duration-150 ${
									sidebarExpanded ? "max-w-xs opacity-100" : "max-w-0 opacity-0"
								}`}
							>
								{reconnecting ? "Connecting…" : "Retry connection"}
							</span>
						</button>
						{!sidebarExpanded && (
							<div
								className="pointer-events-none absolute left-full top-1/2 z-50 ml-2 -translate-y-1/2 whitespace-nowrap rounded bg-surface-2 px-2 py-1 text-xs text-fg opacity-0 shadow-md transition-opacity duration-150 delay-300 group-hover:opacity-100"
								role="tooltip"
							>
								Retry connection
							</div>
						)}
					</div>
				)}

				{/* Search trigger */}
				<div className="group relative">
					<button
						type="button"
						onClick={openCommandPalette}
						className={`flex w-full items-center gap-2.5 rounded-md h-9 px-2.5 text-nav-fg hover:text-nav-fg-active hover:bg-white/5 transition-colors duration-150 ${
							sidebarExpanded ? "justify-start" : "justify-center"
						}`}
						aria-label="Open search"
					>
						<Search size={18} className="shrink-0" />
						<span
							className={`text-sm whitespace-nowrap overflow-hidden transition-[max-width,opacity] duration-150 flex-1 text-left ${
								sidebarExpanded ? "max-w-xs opacity-100" : "max-w-0 opacity-0"
							}`}
						>
							Search...
						</span>
						<kbd
							className={`text-xs text-muted whitespace-nowrap overflow-hidden transition-[max-width,opacity] duration-150 ${
								sidebarExpanded ? "max-w-xs opacity-100" : "max-w-0 opacity-0"
							}`}
						>
							⌘K
						</kbd>
					</button>
					{!sidebarExpanded && (
						<div
							className="pointer-events-none absolute left-full top-1/2 z-50 ml-2 -translate-y-1/2 whitespace-nowrap rounded bg-surface-2 px-2 py-1 text-xs text-fg opacity-0 shadow-md transition-opacity duration-150 delay-300 group-hover:opacity-100"
							role="tooltip"
						>
							Search <span className="ml-1 text-muted">⌘K</span>
						</div>
					)}
				</div>
			</div>

			{/* Nav items */}
			<div className="flex flex-col gap-0.5 px-2 flex-1">
				{items.map((item) => {
					const active = isActive(item.path)
					const Icon = item.icon
					const dimmed = status === "offline" && PROXY_REQUIRED.has(item.path)
					return (
						<div key={item.path} className={`group relative ${dimmed ? "opacity-40" : ""}`}>
							<button
								type="button"
								onClick={() => navigateWithTransition(item.path, navigate)}
								aria-label={item.label}
								aria-current={active ? "page" : undefined}
								className={`relative flex w-full items-center gap-3 rounded-md h-9 px-2.5 transition-all duration-150 ${
									active
										? "bg-white/10 text-nav-fg-active"
										: "text-nav-fg hover:text-nav-fg-active hover:bg-white/5"
								}`}
							>
								{active && (
									<span
										className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r bg-accent animate-in fade-in duration-200"
										aria-hidden="true"
									/>
								)}
								<Icon size={18} className="shrink-0" />
								<span
									className={`text-sm font-medium whitespace-nowrap overflow-hidden transition-[max-width,opacity] duration-150 ${
										sidebarExpanded ? "max-w-xs opacity-100" : "max-w-0 opacity-0"
									}`}
								>
									{item.label}
								</span>
							</button>
							{/* Tooltip — only when collapsed */}
							{!sidebarExpanded && (
								<div
									className="pointer-events-none absolute left-full top-1/2 z-50 ml-2 -translate-y-1/2 whitespace-nowrap rounded bg-surface-2 px-2 py-1 text-xs text-fg opacity-0 shadow-md transition-opacity duration-150 delay-300 group-hover:opacity-100"
									role="tooltip"
								>
									{item.label}
									<span className="ml-2 text-muted">{item.shortcut}</span>
								</div>
							)}
						</div>
					)
				})}
			</div>

			{/* Bottom: collapse toggle */}
			<div className="px-2 pt-2 border-t border-white/10 mt-2">
				<button
					type="button"
					onClick={toggleSidebar}
					className="flex w-full items-center gap-3 rounded-md h-9 px-2.5 text-nav-fg hover:text-nav-fg-active hover:bg-white/5 transition-colors duration-150"
					aria-label={sidebarExpanded ? "Collapse sidebar" : "Expand sidebar"}
					title={sidebarExpanded ? "Collapse sidebar [" : "Expand sidebar ["}
				>
					{sidebarExpanded ? (
						<PanelLeftClose size={18} className="shrink-0" />
					) : (
						<PanelLeftOpen size={18} className="shrink-0" />
					)}
					<span
						className={`text-sm whitespace-nowrap overflow-hidden transition-[max-width,opacity] duration-150 ${
							sidebarExpanded ? "max-w-xs opacity-100" : "max-w-0 opacity-0"
						}`}
					>
						Collapse
					</span>
				</button>
			</div>
		</nav>
	)
}
