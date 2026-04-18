// localStorage keys — centralised to prevent typos
export const ONBOARDING_SEEN = "bpmnkit:onboarding-seen"
export const ONBOARDING_EXAMPLE_OPENED = "bpmnkit:onboarding-example-opened"
export const ONBOARDING_INSTANCE_STARTED = "bpmnkit:onboarding-instance-started"
export const ONBOARDING_HIDDEN = "bpmnkit:onboarding-hidden"
export const ONBOARDING_COLLAPSED = "bpmnkit:onboarding-collapsed"

function get(key: string): boolean {
	try {
		return localStorage.getItem(key) === "true"
	} catch {
		return false
	}
}

function set(key: string): void {
	try {
		localStorage.setItem(key, "true")
	} catch {
		// storage unavailable
	}
}

function remove(key: string): void {
	try {
		localStorage.removeItem(key)
	} catch {
		// storage unavailable
	}
}

export interface OnboardingState {
	seen: boolean
	exampleOpened: boolean
	instanceStarted: boolean
	hidden: boolean
	collapsed: boolean
}

export function getOnboardingState(): OnboardingState {
	return {
		seen: get(ONBOARDING_SEEN),
		exampleOpened: get(ONBOARDING_EXAMPLE_OPENED),
		instanceStarted: get(ONBOARDING_INSTANCE_STARTED),
		hidden: get(ONBOARDING_HIDDEN),
		collapsed: get(ONBOARDING_COLLAPSED),
	}
}

export function markSeen(): void {
	set(ONBOARDING_SEEN)
}

export function markExampleOpened(): void {
	set(ONBOARDING_EXAMPLE_OPENED)
}

export function markInstanceStarted(): void {
	set(ONBOARDING_INSTANCE_STARTED)
}

export function hideOnboarding(): void {
	set(ONBOARDING_HIDDEN)
}

export function setCollapsed(collapsed: boolean): void {
	if (collapsed) {
		set(ONBOARDING_COLLAPSED)
	} else {
		remove(ONBOARDING_COLLAPSED)
	}
}
