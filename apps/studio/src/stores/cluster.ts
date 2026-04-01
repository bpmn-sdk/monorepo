import { create } from "zustand"
import { queryClient } from "../api/queryClient.js"
import { initWasmEngine, setSimulationMode as setWasmSimulationMode } from "../api/wasm-adapter.js"

const PROFILE_KEY = "bpmnkit-studio-profile"
const PROXY_KEY = "bpmnkit-studio-proxy"
const DEFAULT_PROXY = "http://localhost:3033"

const WASM_PROFILE: Profile = { name: "reebe-wasm", apiType: "wasm" }

export interface Profile {
	name: string
	apiType: string
	active?: boolean
	description?: string
	tags?: string[]
}

type Status = "connected" | "offline" | "loading"

interface ClusterState {
	profiles: Profile[]
	activeProfile: string | null
	proxyUrl: string
	status: Status
	simulationMode: boolean
	loadProfiles(): Promise<void>
	setActiveProfile(name: string | null): void
	setProxyUrl(url: string): void
	setSimulationMode(v: boolean): void
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
	simulationMode: false,

	async loadProfiles() {
		const { proxyUrl, activeProfile: current } = get()

		set({ status: "loading" })

		// Always fetch proxy profiles — even when wasm is active, so the picker
		// shows all available profiles and the user can switch between them.
		let proxyProfiles: Profile[] = []
		let proxyOk = false
		try {
			const res = await fetch(`${proxyUrl}/profiles`)
			if (res.ok) {
				proxyProfiles = (await res.json()) as Profile[]
				proxyOk = true
			}
		} catch {
			// proxy down — that's ok, wasm still works
		}

		const allProfiles = [...proxyProfiles, WASM_PROFILE]

		// If the wasm profile is active, also initialise the engine.
		if (current === WASM_PROFILE.name) {
			console.log("[reebe-wasm] loadProfiles: wasm profile active, initialising engine…")
			try {
				await initWasmEngine()
				console.log("[reebe-wasm] loadProfiles: engine ready → status=connected")
				set({ status: "connected", profiles: allProfiles, activeProfile: WASM_PROFILE.name })
			} catch (err) {
				console.error("[reebe-wasm] loadProfiles: engine init failed:", err)
				set({ status: "offline", profiles: allProfiles })
			}
			return
		}

		// Re-read activeProfile after the async fetch in case the user switched.
		const { activeProfile } = get()
		let effective = activeProfile
		if (!effective) {
			const activeFromServer = proxyProfiles.find((p) => p.active)
			effective = activeFromServer?.name ?? proxyProfiles[0]?.name ?? null
		}
		set({
			profiles: allProfiles,
			status: proxyOk ? "connected" : "offline",
			activeProfile: effective,
		})
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

	setSimulationMode(v) {
		set({ simulationMode: v })
		setWasmSimulationMode(v)
	},
}))
