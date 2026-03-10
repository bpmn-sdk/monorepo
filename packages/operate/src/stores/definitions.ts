import { MOCK_DEFINITIONS } from "../mock-data.js"
import { createMockStream, createStream } from "../stream.js"
import type { ProcessDefinitionResult } from "../types.js"
import { Store } from "./base.js"

export interface DefinitionsPayload {
	items: ProcessDefinitionResult[]
}

export class DefinitionsStore extends Store<DefinitionsPayload> {
	connect(proxyUrl: string, profile: string | null, interval: number, mock: boolean): void {
		this.set({ loading: true, error: null })

		if (mock) {
			this.setUnsub(
				createMockStream(
					() => ({ items: MOCK_DEFINITIONS }),
					(payload) => this.set({ data: payload, loading: false }),
					interval,
				),
			)
			return
		}

		const params = new URLSearchParams({ topic: "definitions" })
		if (profile) params.set("profile", profile)
		if (interval > 0) params.set("interval", String(interval))
		this.setUnsub(
			createStream<DefinitionsPayload>(
				`${proxyUrl}/operate/stream?${params}`,
				(payload) => this.set({ data: payload, loading: false }),
				(msg) => this.set({ error: msg, loading: false }),
			),
		)
	}
}
