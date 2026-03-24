import { create } from "zustand"
import { queryClient } from "../api/queryClient.js"

const PROFILE_KEY = "bpmnkit-studio-profile"
const PROXY_KEY = "bpmnkit-studio-proxy"
const DEFAULT_PROXY = "http://localhost:3033"

export interface Profile {
	name: string
	apiType: string
	active?: boolean
}

type Status = "connected" | "offline" | "loading"

interface ClusterState {
	profiles: Profile[]
	activeProfile: string | null
	proxyUrl: string
	status: Status
	loadProfiles(): Promise<void>
	setActiveProfile(name: string | null): void
	setProxyUrl(url: string): void
}

function loadProxyUrl(): string {
	try {
		return localStorage.getItem(PROXY_KEY) ?? DEFAULT_PROXY
	} catch {
		return DEFAULT_PROXY
	}
}

function loadActiveProfile(): string | null {
	try {
		return localStorage.getItem(PROFILE_KEY)
	} catch {
		return null
	}
}

export const useClusterStore = create<ClusterState>()((set, get) => ({
	profiles: [],
	activeProfile: loadActiveProfile(),
	proxyUrl: loadProxyUrl(),
	status: "loading",

	async loadProfiles() {
		const { proxyUrl } = get()
		set({ status: "loading" })
		try {
			const res = await fetch(`${proxyUrl}/profiles`)
			if (!res.ok) throw new Error(`HTTP ${res.status}`)
			const data = (await res.json()) as Profile[]
			const { activeProfile } = get()
			// If no active profile persisted, use the first active one from server
			let effective = activeProfile
			if (!effective) {
				const activeFromServer = data.find((p) => p.active)
				effective = activeFromServer?.name ?? data[0]?.name ?? null
			}
			set({ profiles: data, status: "connected", activeProfile: effective })
		} catch {
			set({ status: "offline" })
		}
	},

	setActiveProfile(name) {
		set({ activeProfile: name })
		try {
			if (name) {
				localStorage.setItem(PROFILE_KEY, name)
			} else {
				localStorage.removeItem(PROFILE_KEY)
			}
		} catch {
			// storage unavailable
		}
		// Clear all cached cluster data so the new profile's data loads fresh
		queryClient.clear()
	},

	setProxyUrl(url) {
		set({ proxyUrl: url })
		try {
			localStorage.setItem(PROXY_KEY, url)
		} catch {
			// storage unavailable
		}
	},
}))
