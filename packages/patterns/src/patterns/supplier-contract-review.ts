import type { Pattern } from "../types.js"

export const supplierContractReview: Pattern = {
	id: "supplier-contract-review",
	name: "Supplier Contract Review",
	description:
		"Procurement and legal workflow for reviewing, negotiating, and executing supplier contracts",
	keywords: [
		"contract",
		"supplier",
		"vendor",
		"procurement",
		"legal",
		"review",
		"NDA",
		"agreement",
		"MSA",
		"SLA",
		"negotiation",
	],
	readme: `## Supplier Contract Review

Structured workflow for reviewing new supplier contracts, ensuring legal and compliance
sign-off, and executing the final agreement.

### Key steps
1. **Contract intake**: receive contract document, classify type (NDA, MSA, SoW, etc.)
2. **Risk assessment**: automated scan for non-standard clauses, liability caps, IP ownership
3. **Legal review**: in-house counsel or external law firm reviews redlines
4. **Compliance check**: GDPR data processing agreement, security requirements, export controls
5. **Negotiation loop**: may iterate multiple rounds with the supplier
6. **Approval**: procurement manager + legal sign-off
7. **Execution**: e-signature and contract storage

### Key considerations
- **Contract lifecycle**: track start/end dates, renewal windows, notice periods
- **Governing law**: jurisdiction affects which clauses are enforceable
- **Data processing**: any contract involving personal data processing requires a DPA
- **Indemnification and liability**: standard max liability caps vary by industry
- **IP ownership**: work-for-hire clauses must be explicit for custom development contracts`,

	workers: [
		{
			name: "classify-contract",
			jobType: "com.example:contract:classify:1",
			description: "Extract contract metadata and classify type using AI",
			inputs: {
				documentUrl: "string — URL or path to the contract document",
			},
			outputs: {
				contractType: "string — NDA | MSA | SoW | DPA | Amendment",
				parties: "string[]",
				effectiveDate: "string",
				expiryDate: "string",
				autoRenew: "boolean",
			},
			externalApis: ["Ironclad", "Icertis", "Luminance", "AWS Textract"],
		},
		{
			name: "risk-scan",
			jobType: "com.example:contract:risk-scan:1",
			description: "AI-powered scan for non-standard clauses, missing provisions, and risk factors",
			inputs: {
				documentUrl: "string",
				contractType: "string",
			},
			outputs: {
				riskScore: "number — 0–100",
				findings: "array of { clause, risk, suggestion }",
				requiresLegalReview: "boolean",
			},
			externalApis: ["Kira Systems", "LexCheck", "Ironclad", "Luminance"],
		},
		{
			name: "store-in-clm",
			jobType: "com.example:clm:store:1",
			description:
				"Store executed contract and metadata in the contract lifecycle management system",
			inputs: {
				documentUrl: "string",
				metadata: "object — contract metadata",
				status: "string",
			},
			outputs: {
				contractId: "string",
				contractUrl: "string",
			},
			externalApis: ["Ironclad", "Icertis", "DocuSign CLM", "Salesforce CLM"],
		},
		{
			name: "request-esignature",
			jobType: "com.example:esign:send:1",
			description: "Send contract for electronic signature to all parties",
			inputs: {
				documentUrl: "string",
				signatories: "array of { name, email, role }",
			},
			outputs: {
				envelopeId: "string",
				signingUrl: "string",
			},
			externalApis: ["DocuSign", "Adobe Sign", "HelloSign / Dropbox Sign"],
		},
	],

	variations: `## Common variations

### Multi-round negotiation
Add a loop back from legal review to a "Send Redlines" task and an intermediate
message catch event to wait for the supplier's counter-proposal.

### Fast-track for low-risk
If risk score is below threshold, skip full legal review and route directly to
procurement manager approval.

### External counsel
For high-value or high-risk contracts, add a parallel path that sends to external
law firm via email or a legal platform, then waits for their markup.

### Renewal reminders
After execution, add a timer intermediate catch event (configured to fire N days before
expiry) to trigger a renewal review sub-process.`,

	template: {
		id: "supplier-contract-review",
		processes: [
			{
				id: "Process_contractReview",
				name: "Supplier Contract Review",
				elements: [
					{ id: "start", type: "startEvent", name: "Contract Received" },
					{
						id: "classifyContract",
						type: "serviceTask",
						name: "Classify Contract",
						jobType: "com.example:contract:classify:1",
					},
					{
						id: "riskScan",
						type: "serviceTask",
						name: "Risk Scan",
						jobType: "com.example:contract:risk-scan:1",
					},
					{ id: "riskGw", type: "exclusiveGateway", name: "High Risk?" },
					{ id: "legalReview", type: "userTask", name: "Legal Review" },
					{ id: "complianceCheck", type: "userTask", name: "Compliance Check" },
					{ id: "approvalGw", type: "exclusiveGateway", name: "Approved?" },
					{
						id: "requestSignature",
						type: "serviceTask",
						name: "Request E-Signature",
						jobType: "com.example:esign:send:1",
					},
					{
						id: "waitForSignature",
						type: "intermediateCatchEvent",
						name: "Wait for Signature",
						eventType: "message",
					},
					{
						id: "storeContract",
						type: "serviceTask",
						name: "Store in CLM",
						jobType: "com.example:clm:store:1",
					},
					{
						id: "notifyRejection",
						type: "serviceTask",
						name: "Notify Rejection",
						jobType: "io.bpmnkit:email:send:1",
					},
					{ id: "end", type: "endEvent", name: "Contract Executed" },
					{ id: "endRejected", type: "endEvent", name: "Contract Rejected" },
				],
				flows: [
					{ id: "f1", from: "start", to: "classifyContract" },
					{ id: "f2", from: "classifyContract", to: "riskScan" },
					{ id: "f3", from: "riskScan", to: "riskGw" },
					{
						id: "f4",
						from: "riskGw",
						to: "legalReview",
						name: "High risk",
						condition: "= riskScore >= 60",
					},
					{ id: "f5", from: "riskGw", to: "complianceCheck", name: "Low risk" },
					{ id: "f6", from: "legalReview", to: "complianceCheck" },
					{ id: "f7", from: "complianceCheck", to: "approvalGw" },
					{
						id: "f8",
						from: "approvalGw",
						to: "requestSignature",
						name: "Approved",
						condition: '= decision = "approved"',
					},
					{ id: "f9", from: "approvalGw", to: "notifyRejection", name: "Rejected" },
					{ id: "f10", from: "requestSignature", to: "waitForSignature" },
					{ id: "f11", from: "waitForSignature", to: "storeContract" },
					{ id: "f12", from: "storeContract", to: "end" },
					{ id: "f13", from: "notifyRejection", to: "endRejected" },
				],
			},
		],
	},
}
