import type { StreamEvent } from "./types.js"

type Unsub = () => void

/** Opens an SSE stream to the proxy's /operate/stream endpoint. Returns unsubscribe. */
export function createStream<T>(
	url: string,
	onData: (payload: T) => void,
	onError: (msg: string) => void,
): Unsub {
	const es = new EventSource(url)

	es.onmessage = (e: MessageEvent) => {
		try {
			const event = JSON.parse(e.data as string) as StreamEvent<T>
			if (event.type === "data" && event.payload !== undefined) {
				onData(event.payload)
			} else if (event.type === "error") {
				onError(event.message ?? "Stream error")
			}
		} catch {
			// ignore malformed events
		}
	}

	es.onerror = () => {
		onError("Connection lost. Retrying…")
	}

	return () => es.close()
}

/** Simulates an SSE stream using mock data. Calls onData immediately and then on interval. */
export function createMockStream<T>(
	getData: () => T,
	onData: (payload: T) => void,
	interval: number,
): Unsub {
	onData(getData())
	if (interval <= 0) return () => {}
	const id = setInterval(() => onData(getData()), interval)
	return () => clearInterval(id)
}
