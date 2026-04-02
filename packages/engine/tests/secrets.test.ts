import { describe, expect, it } from "vitest"
import { EnvSecretResolver, resolveSecretString } from "../src/secrets.js"
import type { SecretResolver } from "../src/secrets.js"

function makeResolver(map: Record<string, string>): SecretResolver {
	return { resolve: async (name) => map[name] }
}

describe("resolveSecretString", () => {
	it("returns the original string unchanged when no placeholders", async () => {
		const r = makeResolver({})
		expect(await resolveSecretString("https://api.example.com", r)).toBe("https://api.example.com")
	})

	it("replaces a single placeholder", async () => {
		const r = makeResolver({ MY_TOKEN: "secret123" })
		expect(await resolveSecretString("Bearer {{secrets.MY_TOKEN}}", r)).toBe("Bearer secret123")
	})

	it("replaces multiple different placeholders", async () => {
		const r = makeResolver({ HOST: "api.example.com", KEY: "abc" })
		expect(await resolveSecretString("https://{{secrets.HOST}}/v1?key={{secrets.KEY}}", r)).toBe(
			"https://api.example.com/v1?key=abc",
		)
	})

	it("replaces repeated occurrences of the same placeholder", async () => {
		const r = makeResolver({ TOKEN: "xyz" })
		expect(await resolveSecretString("{{secrets.TOKEN}} and {{secrets.TOKEN}}", r)).toBe(
			"xyz and xyz",
		)
	})

	it("throws when a referenced secret is missing", async () => {
		const r = makeResolver({})
		await expect(resolveSecretString("Bearer {{secrets.MISSING}}", r)).rejects.toThrow(
			'Secret "{{secrets.MISSING}}" is not configured',
		)
	})

	it("handles a value that is purely the placeholder", async () => {
		const r = makeResolver({ API_KEY: "tok-abc" })
		expect(await resolveSecretString("{{secrets.API_KEY}}", r)).toBe("tok-abc")
	})
})

describe("EnvSecretResolver", () => {
	it("resolves from process.env", async () => {
		process.env.__TEST_SECRET__ = "hello"
		const resolver = new EnvSecretResolver()
		expect(await resolver.resolve("__TEST_SECRET__")).toBe("hello")
		process.env.__TEST_SECRET__ = undefined
	})

	it("returns undefined for missing keys", async () => {
		const resolver = new EnvSecretResolver()
		expect(await resolver.resolve("__DOES_NOT_EXIST__")).toBeUndefined()
	})
})
