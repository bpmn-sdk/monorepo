import { create } from "zustand"
import { queryClient } from "../api/queryClient.js"
import { initWasmEngine } from "../api/wasm-adapter.js"

const PROFILE_KEY = "bpmnkit-studio-profile"
const PROXY_KEY = "bpmnkit-studio-proxy"
const DEFAULT_PROXY = "http://localhost:3033"

const WASM_PROFILE: Profile = { name: "reebe-wasm", apiType: "wasm" }

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
		const { proxyUrl, activeProfile: current } = get()

		// If the wasm profile is active, initialise the engine and go connected.
		if (current === WASM_PROFILE.name) {
			console.log("[reebe-wasm] loadProfiles: wasm profile active, initialising engine…")
			set({ status: "loading" })
			try {
				await initWasmEngine()
				console.log("[reebe-wasm] loadProfiles: engine ready → status=connected")
				set({ status: "connected", profiles: [WASM_PROFILE], activeProfile: WASM_PROFILE.name })
			} catch (err) {
				console.error("[reebe-wasm] loadProfiles: engine init failed:", err)
				set({ status: "offline" })
			}
			return
		}

		set({ status: "loading" })
		try {
			const res = await fetch(`${proxyUrl}/profiles`)
			if (!res.ok) throw new Error(`HTTP ${res.status}`)
			const data = (await res.json()) as Profile[]
			// Always include the wasm profile at the end
			const allProfiles = [...data, WASM_PROFILE]
			const { activeProfile } = get()
			// If no active profile persisted, use the first active one from server
			let effective = activeProfile
			if (!effective) {
				const activeFromServer = data.find((p) => p.active)
				effective = activeFromServer?.name ?? data[0]?.name ?? null
			}
			set({ profiles: allProfiles, status: "connected", activeProfile: effective })
		} catch {
			// Proxy is down — still expose the wasm profile
			set({ status: "offline", profiles: [WASM_PROFILE] })
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
		// If switching to wasm, init engine and mark connected immediately
		if (name === WASM_PROFILE.name) {
			console.log("[reebe-wasm] setActiveProfile: switching to wasm, initialising engine…")
			set({ status: "loading" })
			void initWasmEngine()
				.then(() => {
					console.log("[reebe-wasm] setActiveProfile: engine ready → status=connected")
					set({ status: "connected" })
				})
				.catch((err) => {
					console.error("[reebe-wasm] setActiveProfile: engine init failed:", err)
					set({ status: "offline" })
				})
		}
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
