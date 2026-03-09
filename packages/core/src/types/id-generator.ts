const ALPHABET = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
const ID_SIZE = 8

function nanoId(): string {
	const bytes = new Uint8Array(ID_SIZE)
	crypto.getRandomValues(bytes)
	let id = ""
	for (let i = 0; i < ID_SIZE; i++) {
		id += ALPHABET[(bytes[i] as number) % ALPHABET.length]
	}
	return id
}

// Counter used only in deterministic test mode (activated by resetIdCounter())
let _counter = 0
let _deterministic = false

/** Generates a unique ID with the given prefix. */
export function generateId(prefix: string): string {
	if (_deterministic) {
		_counter++
		return `${prefix}_${_counter.toString(36).padStart(7, "0")}`
	}
	return `${prefix}_${nanoId()}`
}

/**
 * Switches to deterministic counter-based IDs and resets the counter.
 * Call this in test `beforeEach` to get stable, predictable IDs.
 */
export function resetIdCounter(): void {
	_counter = 0
	_deterministic = true
}
