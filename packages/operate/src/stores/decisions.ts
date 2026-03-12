import { MOCK_DECISIONS } from "../mock-data.js"
import { createMockStream, createStream } from "../stream.js"
import type { DecisionDefinitionResult } from "../types.js"
import { Store } from "./base.js"

export interface DecisionsPayload {
	items: DecisionDefinitionResult[]
}

export class DecisionsStore extends Store<DecisionsPayload> {
	connect(proxyUrl: string, profile: string | null, interval: number, mock: boolean): void {
		this.set({ loading: true, error: null })

		if (mock) {
			this.setUnsub(
				createMockStream(
					() => ({ items: MOCK_DECISIONS }),
					(payload) => this.set({ data: payload, loading: false }),
					interval,
				),
			)
			return
		}

		const params = new URLSearchParams({ topic: "decisions" })
		if (profile) params.set("profile", profile)
		if (interval > 0) params.set("interval", String(interval))
		this.setUnsub(
			createStream<DecisionsPayload>(
				`${proxyUrl}/operate/stream?${params}`,
				(payload) => this.set({ data: payload, loading: false }),
				(msg) => this.set({ error: msg, loading: false }),
			),
		)
	}
}
