import { beforeEach, describe, expect, it } from "vitest"
import {
	ONBOARDING_COLLAPSED,
	ONBOARDING_EXAMPLE_OPENED,
	ONBOARDING_HIDDEN,
	ONBOARDING_INSTANCE_STARTED,
	ONBOARDING_SEEN,
	getOnboardingState,
	hideOnboarding,
	markExampleOpened,
	markInstanceStarted,
	markSeen,
	setCollapsed,
} from "../src/lib/onboarding.js"

// Minimal localStorage shim for Node/Vitest
const store: Record<string, string> = {}
const localStorageMock = {
	getItem: (k: string) => store[k] ?? null,
	setItem: (k: string, v: string) => {
		store[k] = v
	},
	removeItem: (k: string) => {
		delete store[k]
	},
}
Object.defineProperty(globalThis, "localStorage", { value: localStorageMock, writable: true })

beforeEach(() => {
	for (const k of Object.keys(store)) delete store[k]
})

describe("getOnboardingState", () => {
	it("returns all false on fresh install", () => {
		expect(getOnboardingState()).toEqual({
			seen: false,
			exampleOpened: false,
			instanceStarted: false,
			hidden: false,
			collapsed: false,
		})
	})

	it("reflects markSeen", () => {
		markSeen()
		expect(getOnboardingState().seen).toBe(true)
	})

	it("reflects markExampleOpened", () => {
		markExampleOpened()
		expect(getOnboardingState().exampleOpened).toBe(true)
	})

	it("reflects markInstanceStarted", () => {
		markInstanceStarted()
		expect(getOnboardingState().instanceStarted).toBe(true)
	})

	it("reflects hideOnboarding", () => {
		hideOnboarding()
		expect(getOnboardingState().hidden).toBe(true)
	})

	it("reflects setCollapsed true then false", () => {
		setCollapsed(true)
		expect(getOnboardingState().collapsed).toBe(true)
		setCollapsed(false)
		expect(getOnboardingState().collapsed).toBe(false)
	})
})

describe("key constants", () => {
	it("each key is distinct", () => {
		const keys = [
			ONBOARDING_SEEN,
			ONBOARDING_EXAMPLE_OPENED,
			ONBOARDING_INSTANCE_STARTED,
			ONBOARDING_HIDDEN,
			ONBOARDING_COLLAPSED,
		]
		expect(new Set(keys).size).toBe(keys.length)
	})
})
