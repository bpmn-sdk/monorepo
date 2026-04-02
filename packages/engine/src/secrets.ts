/** Interface for resolving secret values by name. */
export interface SecretResolver {
	resolve(name: string): Promise<string | undefined>
}

const SECRET_RE = /\{\{secrets\.([^}]+)\}\}/g

/**
 * Replace all `{{secrets.NAME}}` placeholders in `value` using the given resolver.
 * Returns the original string unchanged if no placeholders are present.
 * Throws if any referenced secret is not configured.
 */
export async function resolveSecretString(
	value: string,
	resolver: SecretResolver,
): Promise<string> {
	if (!value.includes("{{secrets.")) return value

	// Collect all unique names first to allow parallel resolution
	const names = new Set<string>()
	for (const m of value.matchAll(SECRET_RE)) {
		if (m[1]) names.add(m[1])
	}

	const resolved = new Map<string, string>()
	await Promise.all(
		[...names].map(async (name) => {
			const val = await resolver.resolve(name)
			if (val === undefined) {
				throw new Error(`Secret "{{secrets.${name}}}" is not configured`)
			}
			resolved.set(name, val)
		}),
	)

	return value.replace(SECRET_RE, (_match, name: string) => resolved.get(name) ?? "")
}

/**
 * Secret resolver that reads from `process.env`.
 * Works in Node.js; always returns `undefined` in browser contexts.
 */
export class EnvSecretResolver implements SecretResolver {
	async resolve(name: string): Promise<string | undefined> {
		return typeof process !== "undefined" ? process.env[name] : undefined
	}
}
