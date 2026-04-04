export type {
	Pattern,
	PatternTemplate,
	PatternProcess,
	PatternElement,
	PatternFlow,
	WorkerSpec,
} from "./types.js"

export { invoiceApproval } from "./patterns/invoice-approval.js"
export { employeeOnboarding } from "./patterns/employee-onboarding.js"
export { supplierContractReview } from "./patterns/supplier-contract-review.js"
export { incidentResponse } from "./patterns/incident-response.js"
export { loanOrigination } from "./patterns/loan-origination.js"
export { contentModeration } from "./patterns/content-moderation.js"
export { orderFulfillment } from "./patterns/order-fulfillment.js"

import { contentModeration } from "./patterns/content-moderation.js"
import { employeeOnboarding } from "./patterns/employee-onboarding.js"
import { incidentResponse } from "./patterns/incident-response.js"
import { invoiceApproval } from "./patterns/invoice-approval.js"
import { loanOrigination } from "./patterns/loan-origination.js"
import { orderFulfillment } from "./patterns/order-fulfillment.js"
import { supplierContractReview } from "./patterns/supplier-contract-review.js"
import type { Pattern } from "./types.js"

export const ALL_PATTERNS: Pattern[] = [
	invoiceApproval,
	employeeOnboarding,
	supplierContractReview,
	incidentResponse,
	loanOrigination,
	contentModeration,
	orderFulfillment,
]

/**
 * Find a pattern by exact id or by keyword match.
 * Returns the best match or undefined if no pattern is relevant.
 */
export function findPattern(query: string): Pattern | undefined {
	const q = query.toLowerCase()

	// Exact id match first
	const byId = ALL_PATTERNS.find((p) => p.id === q)
	if (byId) return byId

	// Keyword match — count hits, return highest
	let best: Pattern | undefined
	let bestScore = 0
	for (const pattern of ALL_PATTERNS) {
		const score = pattern.keywords.filter((k) => q.includes(k.toLowerCase())).length
		if (score > bestScore) {
			bestScore = score
			best = pattern
		}
	}
	return bestScore > 0 ? best : undefined
}
