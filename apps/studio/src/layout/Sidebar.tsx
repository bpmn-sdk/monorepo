import {
	AlertTriangle,
	CheckSquare,
	FileText,
	FolderOpen,
	GitBranch,
	Layers,
	LayoutDashboard,
	Play,
	Settings,
} from "lucide-react"
import { useLocation } from "wouter"
import { useClusterStore } from "../stores/cluster.js"
import { useModeStore } from "../stores/mode.js"

interface NavItem {
	icon: typeof LayoutDashboard
	label: string
	path: string
	shortcut: string
}

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
	const { status } = useClusterStore()
	const items = getOrderedItems(mode)

	function isActive(path: string) {
		if (path === "/") return location === "/"
		return location.startsWith(path)
	}

	return (
		<nav
			className="flex w-16 shrink-0 flex-col items-center gap-1 bg-nav py-2"
			aria-label="Main navigation"
		>
			{items.map((item) => {
				const active = isActive(item.path)
				const Icon = item.icon
				return (
					<div key={item.path} className="group relative">
						<button
							type="button"
							onClick={() => navigate(item.path)}
							aria-label={item.label}
							aria-current={active ? "page" : undefined}
							className={`relative flex h-10 w-10 items-center justify-center rounded transition-colors ${
								active
									? "text-nav-fg-active"
									: "text-nav-fg hover:text-nav-fg-active hover:bg-white/5"
							}`}
						>
							{active && (
								<span
									className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r bg-accent"
									aria-hidden="true"
								/>
							)}
							<Icon size={20} />
						</button>
						<div
							className="pointer-events-none absolute left-full top-1/2 z-50 ml-2 -translate-y-1/2 whitespace-nowrap rounded bg-surface-2 px-2 py-1 text-xs text-fg opacity-0 shadow-md transition-opacity group-hover:opacity-100"
							role="tooltip"
						>
							{item.label}
							<span className="ml-2 text-muted">{item.shortcut}</span>
						</div>
					</div>
				)
			})}

			{/* Cluster status indicator at bottom */}
			<div className="group relative mt-auto pb-2">
				<div
					className={`h-2.5 w-2.5 rounded-full ${status === "connected" ? "bg-success" : status === "loading" ? "bg-warn" : "bg-danger"}`}
					aria-label={`Cluster ${status}`}
				/>
				<div
					className="pointer-events-none absolute left-full top-1/2 z-50 ml-2 -translate-y-1/2 whitespace-nowrap rounded bg-surface-2 px-2 py-1 text-xs text-fg opacity-0 shadow-md transition-opacity group-hover:opacity-100"
					role="tooltip"
				>
					Cluster: {status}
				</div>
			</div>
		</nav>
	)
}
