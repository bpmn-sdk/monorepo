import { Link } from "wouter"
import { useClusterStore } from "../stores/cluster.js"
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "./ui/dropdown-menu.js"

export function ClusterPicker() {
	const { profiles, activeProfile, status, setActiveProfile } = useClusterStore()

	const statusColor =
		status === "connected" ? "bg-success" : status === "loading" ? "bg-warn" : "bg-danger"

	return (
		<DropdownMenu>
			<DropdownMenuTrigger
				className="flex items-center gap-1.5 rounded px-2 py-1 text-sm text-fg hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-accent"
				aria-label="Select cluster profile"
			>
				<span className={`h-2 w-2 rounded-full ${statusColor}`} aria-hidden="true" />
				<span className="max-w-32 truncate">
					{activeProfile ?? (status === "offline" ? "No cluster" : "Select profile")}
				</span>
				<span className="text-muted">▾</span>
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
	)
}
