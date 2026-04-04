import type { Pattern } from "../types.js"

export const loanOrigination: Pattern = {
	id: "loan-origination",
	name: "Loan Origination",
	description:
		"Financial services workflow for processing loan applications from submission to disbursement",
	keywords: [
		"loan",
		"credit",
		"mortgage",
		"lending",
		"application",
		"origination",
		"underwriting",
		"financial services",
		"bank",
		"fintech",
	],
	readme: `## Loan Origination

End-to-end workflow that takes a loan application from initial submission through
credit assessment, underwriting, approval, and fund disbursement.

### Key phases
1. **Application intake**: collect applicant information, requested amount, purpose
2. **Identity verification**: confirm applicant identity (KYC)
3. **Credit check**: pull credit bureau data, compute credit score
4. **Risk scoring**: internal scoring model combining credit, income, LTV
5. **Underwriting decision**: automated decision or referral to human underwriter
6. **Offer generation**: calculate rate, term, monthly payment
7. **Customer acceptance**: applicant reviews and accepts offer
8. **Disbursement**: transfer funds to applicant or directly to seller

### Regulatory context
- **KYC/AML**: required in all jurisdictions; verify identity, screen against sanctions lists
- **Fair lending**: decisions must not discriminate based on protected characteristics
- **Truth in Lending (TILA / APR disclosure)**: US requirement; equivalent in EU (CCD)
- **GDPR**: data minimisation — collect only what's needed, define retention periods
- **Model risk management**: automated scoring models require regular validation and audit trails

### Risk scoring factors
Income, employment stability, credit score, debt-to-income ratio, loan-to-value (for secured),
collateral quality, repayment history.`,

	workers: [
		{
			name: "verify-identity",
			jobType: "com.example:kyc:verify:1",
			description: "Verify applicant identity against government ID and liveness check",
			inputs: {
				firstName: "string",
				lastName: "string",
				dateOfBirth: "string",
				documentType: "string — passport | driving_license | national_id",
				documentImage: "string — base64 or URL",
			},
			outputs: {
				verificationStatus: "string — pass | fail | manual_review",
				verificationId: "string",
			},
			externalApis: ["Onfido", "Jumio", "Persona", "Veriff"],
		},
		{
			name: "credit-check",
			jobType: "com.example:credit:check:1",
			description: "Pull credit report and score from credit bureau",
			inputs: {
				firstName: "string",
				lastName: "string",
				dateOfBirth: "string",
				address: "string",
				ssn: "string — masked, last 4 digits",
			},
			outputs: {
				creditScore: "number",
				bureau: "string",
				reportId: "string",
				negativeFactors: "string[]",
			},
			externalApis: ["Experian", "Equifax", "TransUnion", "Creditsafe"],
		},
		{
			name: "risk-scoring",
			jobType: "com.example:risk:score:1",
			description: "Internal risk scoring model combining all applicant data",
			inputs: {
				creditScore: "number",
				annualIncome: "number",
				requestedAmount: "number",
				loanPurpose: "string",
				employmentStatus: "string",
				existingDebt: "number",
			},
			outputs: {
				riskScore: "number — 0–100 (higher = riskier)",
				riskTier: "string — low | medium | high | declined",
				maxLoanAmount: "number",
				suggestedRate: "number",
			},
		},
		{
			name: "generate-offer",
			jobType: "com.example:loan:generate-offer:1",
			description: "Calculate loan offer: amount, rate, term, monthly payment, APR",
			inputs: {
				requestedAmount: "number",
				maxLoanAmount: "number",
				suggestedRate: "number",
				term: "number — months",
			},
			outputs: {
				offeredAmount: "number",
				annualRate: "number",
				apr: "number",
				monthlyPayment: "number",
				totalCost: "number",
				offerId: "string",
			},
		},
		{
			name: "disburse-funds",
			jobType: "com.example:payment:disburse:1",
			description: "Transfer loan funds to applicant bank account",
			inputs: {
				accountNumber: "string",
				routingNumber: "string",
				amount: "number",
				reference: "string",
			},
			outputs: {
				transactionId: "string",
				disbursedAt: "string",
			},
			externalApis: ["Stripe", "Plaid", "Synapse", "Dwolla", "ACH network"],
		},
	],

	variations: `## Common variations

### Secured vs. unsecured
For secured loans (mortgage, auto), add collateral valuation steps: property appraisal
or vehicle NADA lookup. Gate disbursement on collateral being confirmed.

### Tiered automation
- Low risk + small amount → fully automated, no human underwriter
- Medium risk → automated decision with human review option
- High risk → mandatory human underwriter

### Multi-product
If the applicant qualifies for multiple loan products, add a product selection step
before offer generation.

### Rejection appeal
After automated rejection, add a path allowing the applicant to request human review
of the decision. Use a user task for the underwriter and a timer to ensure SLA.`,

	template: {
		id: "loan-origination",
		processes: [
			{
				id: "Process_loanOrigination",
				name: "Loan Origination",
				elements: [
					{ id: "start", type: "startEvent", name: "Application Submitted" },
					{
						id: "verifyIdentity",
						type: "serviceTask",
						name: "Verify Identity",
						jobType: "com.example:kyc:verify:1",
					},
					{ id: "kycGw", type: "exclusiveGateway", name: "Identity Verified?" },
					{
						id: "creditCheck",
						type: "serviceTask",
						name: "Credit Check",
						jobType: "com.example:credit:check:1",
					},
					{
						id: "riskScoring",
						type: "serviceTask",
						name: "Risk Scoring",
						jobType: "com.example:risk:score:1",
					},
					{ id: "decisionGw", type: "exclusiveGateway", name: "Risk Tier?" },
					{
						id: "autoDecline",
						type: "serviceTask",
						name: "Send Decline Notice",
						jobType: "io.bpmnkit:email:send:1",
					},
					{ id: "underwriterReview", type: "userTask", name: "Underwriter Review" },
					{
						id: "generateOffer",
						type: "serviceTask",
						name: "Generate Offer",
						jobType: "com.example:loan:generate-offer:1",
					},
					{ id: "customerAcceptance", type: "userTask", name: "Customer Reviews Offer" },
					{ id: "acceptanceGw", type: "exclusiveGateway", name: "Accepted?" },
					{
						id: "disburseFunds",
						type: "serviceTask",
						name: "Disburse Funds",
						jobType: "com.example:payment:disburse:1",
					},
					{ id: "end", type: "endEvent", name: "Loan Disbursed" },
					{ id: "endDeclined", type: "endEvent", name: "Application Declined" },
				],
				flows: [
					{ id: "f1", from: "start", to: "verifyIdentity" },
					{ id: "f2", from: "verifyIdentity", to: "kycGw" },
					{
						id: "f3",
						from: "kycGw",
						to: "creditCheck",
						name: "Verified",
						condition: '= verificationStatus = "pass"',
					},
					{ id: "f4", from: "kycGw", to: "autoDecline", name: "Failed" },
					{ id: "f5", from: "creditCheck", to: "riskScoring" },
					{ id: "f6", from: "riskScoring", to: "decisionGw" },
					{
						id: "f7",
						from: "decisionGw",
						to: "autoDecline",
						name: "Declined",
						condition: '= riskTier = "declined"',
					},
					{
						id: "f8",
						from: "decisionGw",
						to: "underwriterReview",
						name: "High risk",
						condition: '= riskTier = "high"',
					},
					{ id: "f9", from: "decisionGw", to: "generateOffer", name: "Low/Medium risk" },
					{ id: "f10", from: "underwriterReview", to: "generateOffer" },
					{ id: "f11", from: "generateOffer", to: "customerAcceptance" },
					{ id: "f12", from: "customerAcceptance", to: "acceptanceGw" },
					{
						id: "f13",
						from: "acceptanceGw",
						to: "disburseFunds",
						name: "Accepted",
						condition: "= accepted = true",
					},
					{ id: "f14", from: "acceptanceGw", to: "endDeclined", name: "Declined" },
					{ id: "f15", from: "autoDecline", to: "endDeclined" },
					{ id: "f16", from: "disburseFunds", to: "end" },
				],
			},
		],
	},
}
