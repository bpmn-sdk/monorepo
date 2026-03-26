import { useClusterStore } from "../stores/cluster.js"
import { wasmRoute } from "./wasm-adapter.js"

export function getProxyUrl(): string {
	return useClusterStore.getState().proxyUrl
}

export function getActiveProfile(): string | null {
	return useClusterStore.getState().activeProfile
}

function isWasmProfile(): boolean {
	return getActiveProfile() === "reebe-wasm"
}

function buildHeaders(extra?: HeadersInit): Record<string, string> {
	const headers: Record<string, string> = {
		accept: "application/json",
		"content-type": "application/json",
	}
	const profile = getActiveProfile()
	if (profile) headers["x-profile"] = profile

	if (extra) {
		const init = new Headers(extra)
		init.forEach((v, k) => {
			headers[k] = v
		})
	}

	return headers
}

export async function proxyFetch<T = unknown>(path: string, options?: RequestInit): Promise<T> {
	if (isWasmProfile()) {
		const method = options?.method ?? "GET"
		return wasmRoute(method, path) as Promise<T>
	}
	const url = `${getProxyUrl()}${path}`
	const headers = buildHeaders(options?.headers)
	const res = await fetch(url, { ...options, headers })
	if (!res.ok) {
		const text = await res.text().catch(() => "")
		throw new Error(`HTTP ${res.status}${text ? `: ${text}` : ""}`)
	}
	return res.json() as Promise<T>
}

export async function proxyPost<T = unknown>(path: string, body?: unknown): Promise<T> {
	if (isWasmProfile()) {
		return wasmRoute("POST", path, body) as Promise<T>
	}
	return proxyFetch<T>(path, {
		method: "POST",
		body: body !== undefined ? JSON.stringify(body) : undefined,
	})
}

export async function proxyPostMultipart<T = unknown>(path: string, form: FormData): Promise<T> {
	if (isWasmProfile()) {
		return wasmRoute("POST", path, undefined, form) as Promise<T>
	}
	const url = `${getProxyUrl()}${path}`
	const headers: Record<string, string> = { accept: "application/json" }
	const profile = getActiveProfile()
	if (profile) headers["x-profile"] = profile

	const res = await fetch(url, { method: "POST", headers, body: form })
	if (!res.ok) {
		const text = await res.text().catch(() => "")
		throw new Error(`HTTP ${res.status}${text ? `: ${text}` : ""}`)
	}
	return res.json() as Promise<T>
}

export async function proxyDelete<T = unknown>(path: string): Promise<T> {
	if (isWasmProfile()) {
		return wasmRoute("DELETE", path) as Promise<T>
	}
	return proxyFetch<T>(path, { method: "DELETE" })
}

export async function proxyFetchText(path: string): Promise<string> {
	if (isWasmProfile()) {
		return wasmRoute("GET", path) as Promise<string>
	}
	const url = `${getProxyUrl()}${path}`
	const headers = buildHeaders({ accept: "*/*" })
	const res = await fetch(url, { headers })
	if (!res.ok) {
		const text = await res.text().catch(() => "")
		throw new Error(`HTTP ${res.status}${text ? `: ${text}` : ""}`)
	}
	return res.text()
}
