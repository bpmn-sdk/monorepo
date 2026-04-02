import type { SecretResolver } from "@bpmnkit/engine"
/**
 * Secrets store — manages an ephemeral AES-256-GCM session key used to safely
 * retrieve connector secrets from the proxy server.
 *
 * Flow:
 * 1. On init, generate a fresh CryptoKey (never persisted).
 * 2. When resolving a secret, POST /secrets/:name with the exported key.
 * 3. The proxy encrypts the env-var value with that key and returns ciphertext.
 * 4. We decrypt locally and cache the result for the session.
 */
import { create } from "zustand"
import { useClusterStore } from "./cluster.js"

function bytesToBase64(buf: ArrayBuffer): string {
	return btoa(String.fromCharCode(...new Uint8Array(buf)))
}

function base64ToBytes(b64: string): Uint8Array<ArrayBuffer> {
	const binary = atob(b64)
	const bytes = new Uint8Array(binary.length)
	for (let i = 0; i < binary.length; i++) {
		bytes[i] = binary.charCodeAt(i)
	}
	return bytes
}

interface SecretsState {
	/** Session-scoped encryption key (never leaves the browser). */
	key: CryptoKey | null
	/** Exported raw key, base64-encoded — sent to the proxy for encryption. */
	keyBase64: string | null
	/** Resolved secret values cached for this session. */
	cache: Map<string, string>

	/** Generate the session key. Called once on app boot. */
	init(): Promise<void>
	/** Resolve a single secret by name. Caches the result. */
	resolve(name: string): Promise<string | undefined>
	/** Check which of the given secret names are configured in the proxy env. */
	checkMany(names: string[]): Promise<Record<string, boolean>>
}

export const useSecretsStore = create<SecretsState>()((set, get) => ({
	key: null,
	keyBase64: null,
	cache: new Map(),

	async init() {
		if (get().key !== null) return
		const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, [
			"encrypt",
			"decrypt",
		])
		const raw = await crypto.subtle.exportKey("raw", key)
		set({ key, keyBase64: bytesToBase64(raw), cache: new Map() })
	},

	async resolve(name: string): Promise<string | undefined> {
		const { cache, key, keyBase64 } = get()
		if (cache.has(name)) return cache.get(name)

		if (key === null || keyBase64 === null) return undefined

		const proxyUrl = useClusterStore.getState().proxyUrl
		let encrypted: string
		let iv: string
		try {
			const res = await fetch(`${proxyUrl}/secrets/${encodeURIComponent(name)}`, {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ key: keyBase64 }),
			})
			if (res.status === 404) return undefined
			if (!res.ok) throw new Error(`HTTP ${res.status}`)
			const data = (await res.json()) as { encrypted: string; iv: string }
			encrypted = data.encrypted
			iv = data.iv
		} catch {
			return undefined
		}

		try {
			const decrypted = await crypto.subtle.decrypt(
				{ name: "AES-GCM", iv: base64ToBytes(iv) },
				key,
				base64ToBytes(encrypted),
			)
			const value = new TextDecoder().decode(decrypted)
			get().cache.set(name, value)
			return value
		} catch {
			return undefined
		}
	},

	async checkMany(names: string[]): Promise<Record<string, boolean>> {
		if (names.length === 0) return {}
		const proxyUrl = useClusterStore.getState().proxyUrl
		try {
			const res = await fetch(`${proxyUrl}/secrets/check`, {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ names }),
			})
			if (!res.ok) return Object.fromEntries(names.map((n) => [n, false]))
			return (await res.json()) as Record<string, boolean>
		} catch {
			return Object.fromEntries(names.map((n) => [n, false]))
		}
	},
}))

/**
 * A `SecretResolver` backed by the proxy secrets store.
 * Pass this to `Engine` options or use with `resolveSecretString`.
 */
export const proxySecretResolver: SecretResolver = {
	resolve: (name) => useSecretsStore.getState().resolve(name),
}
