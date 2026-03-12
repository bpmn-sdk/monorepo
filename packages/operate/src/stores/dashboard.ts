import { getMockDashboard, getMockHistory } from "../mock-data.js"
import { createMockStream, createStream } from "../stream.js"
import type { DashboardData, TimePoint } from "../types.js"
import { Store } from "./base.js"

const MAX_HISTORY = 60

export class DashboardStore extends Store<DashboardData> {
	history: TimePoint[] = []

	private appendHistory(data: DashboardData): void {
		this.history.push({ ts: Date.now(), data })
		if (this.history.length > MAX_HISTORY) {
			this.history.splice(0, this.history.length - MAX_HISTORY)
		}
	}

	connect(proxyUrl: string, profile: string | null, interval: number, mock: boolean): void {
		this.history = []
		this.set({ loading: true, error: null })

		if (mock) {
			this.history = getMockHistory()
			this.setUnsub(
				createMockStream(
					getMockDashboard,
					(payload) => {
						this.appendHistory(payload)
						this.set({ data: payload, loading: false })
					},
					interval,
				),
			)
			return
		}

		const params = new URLSearchParams({ topic: "dashboard" })
		if (profile) params.set("profile", profile)
		if (interval > 0) params.set("interval", String(interval))
		this.setUnsub(
			createStream<DashboardData>(
				`${proxyUrl}/operate/stream?${params}`,
				(payload) => {
					this.appendHistory(payload)
					this.set({ data: payload, loading: false })
				},
				(msg) => this.set({ error: msg, loading: false }),
			),
		)
	}
}
