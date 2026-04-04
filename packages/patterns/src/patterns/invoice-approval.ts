import type { Pattern } from "../types.js"

export const invoiceApproval: Pattern = {
	id: "invoice-approval",
	name: "Invoice Approval",
	description:
		"Accounts-payable workflow that routes invoices for review and approval before payment",
	keywords: [
		"invoice",
		"approval",
		"accounts payable",
		"purchase order",
		"payment",
		"finance",
		"procurement",
		"bill",
		"vendor",
	],
	readme: `## Invoice Approval

Standard accounts-payable process that validates incoming invoices, routes them for
approval based on amount thresholds, and triggers payment on approval.

### Key considerations
- **Three-way match**: best practice to match invoice against PO and goods receipt before approval
- **Delegation of authority (DoA)**: amount thresholds determine who can approve (team lead, manager, CFO)
- **Duplicate detection**: check for duplicate invoice numbers before processing
- **VAT/tax validation**: validate tax amounts and supplier VAT registration
- **Payment terms**: capture due date from invoice to avoid late fees
- **Audit trail**: all approval decisions must be logged with timestamp and approver identity

### Regulatory context
- Many jurisdictions require invoice retention for 7–10 years
- GDPR applies to personal data on invoices (individual freelancers)
- SOX compliance: segregation of duties between requester and approver`,

	workers: [
		{
			name: "validate-invoice",
			jobType: "com.example:invoice:validate:1",
			description:
				"Extract and validate invoice fields: supplier, amount, VAT, due date, line items",
			inputs: {
				documentUrl: "string — URL or path to the invoice document",
				supplierId: "string — known supplier identifier (optional)",
			},
			outputs: {
				invoiceNumber: "string",
				supplierName: "string",
				amount: "number",
				currency: "string",
				dueDate: "string (ISO 8601)",
				lineItems: "array of { description, quantity, unitPrice, total }",
				validationErrors: "string[] — empty if valid",
			},
			externalApis: ["AWS Textract", "Google Document AI", "Rossum", "Mindee"],
		},
		{
			name: "check-duplicate",
			jobType: "com.example:invoice:check-duplicate:1",
			description: "Check whether this invoice number has already been processed",
			inputs: {
				invoiceNumber: "string",
				supplierId: "string",
			},
			outputs: {
				isDuplicate: "boolean",
				existingInvoiceId: "string (if duplicate)",
			},
		},
		{
			name: "notify-approver",
			jobType: "io.bpmnkit:email:send:1",
			description: "Email the approver with invoice details and an approval link",
			inputs: {
				to: "string — approver email",
				subject: "string",
				body: "string",
			},
			outputs: {},
		},
		{
			name: "trigger-payment",
			jobType: "com.example:payment:create:1",
			description: "Initiate payment via ERP or payment system",
			inputs: {
				supplierId: "string",
				amount: "number",
				currency: "string",
				dueDate: "string",
				invoiceNumber: "string",
			},
			outputs: {
				paymentId: "string",
				scheduledDate: "string",
			},
			externalApis: ["SAP", "Oracle NetSuite", "QuickBooks", "Xero", "Stripe"],
		},
	],

	variations: `## Common variations

### Threshold-based routing
Single threshold (e.g. <$1000 auto-approve) vs. tiered (team lead → manager → CFO).
Add extra exclusive gateways and user tasks per tier.

### Three-way match
Insert a service task after validation to fetch the matching PO and goods receipt,
then a gateway to check if all three match before routing to approval.

### ERP integration
Replace the user task with a service task that creates a workflow in the ERP system
(SAP Workflow, Oracle Approvals Management) and waits for a callback message event.

### Rejection handling
On rejection, add a path to notify the vendor and update the ERP with a rejection reason.
Consider whether rejected invoices should be archived or returned for correction.`,

	template: {
		id: "invoice-approval",
		processes: [
			{
				id: "Process_invoiceApproval",
				name: "Invoice Approval",
				elements: [
					{ id: "start", type: "startEvent", name: "Invoice Received" },
					{
						id: "validateInvoice",
						type: "serviceTask",
						name: "Validate Invoice",
						jobType: "com.example:invoice:validate:1",
					},
					{
						id: "checkDuplicate",
						type: "serviceTask",
						name: "Check Duplicate",
						jobType: "com.example:invoice:check-duplicate:1",
					},
					{ id: "duplicateGw", type: "exclusiveGateway", name: "Duplicate?" },
					{ id: "endDuplicate", type: "endEvent", name: "Reject Duplicate" },
					{ id: "amountGw", type: "exclusiveGateway", name: "Amount > Threshold?" },
					{ id: "managerReview", type: "userTask", name: "Manager Review" },
					{ id: "approvalGw", type: "exclusiveGateway", name: "Approved?" },
					{
						id: "triggerPayment",
						type: "serviceTask",
						name: "Trigger Payment",
						jobType: "com.example:payment:create:1",
					},
					{
						id: "notifyRejection",
						type: "serviceTask",
						name: "Notify Rejection",
						jobType: "io.bpmnkit:email:send:1",
					},
					{ id: "end", type: "endEvent", name: "Invoice Processed" },
				],
				flows: [
					{ id: "f1", from: "start", to: "validateInvoice" },
					{ id: "f2", from: "validateInvoice", to: "checkDuplicate" },
					{ id: "f3", from: "checkDuplicate", to: "duplicateGw" },
					{
						id: "f4",
						from: "duplicateGw",
						to: "endDuplicate",
						name: "Yes",
						condition: "= isDuplicate",
					},
					{ id: "f5", from: "duplicateGw", to: "amountGw", name: "No" },
					{
						id: "f6",
						from: "amountGw",
						to: "managerReview",
						name: "High amount",
						condition: "= amount >= 1000",
					},
					{
						id: "f7",
						from: "amountGw",
						to: "approvalGw",
						name: "Low amount (auto-approve)",
						condition: "= amount < 1000",
					},
					{ id: "f8", from: "managerReview", to: "approvalGw" },
					{
						id: "f9",
						from: "approvalGw",
						to: "triggerPayment",
						name: "Approved",
						condition: '= decision = "approved"',
					},
					{ id: "f10", from: "approvalGw", to: "notifyRejection", name: "Rejected" },
					{ id: "f11", from: "triggerPayment", to: "end" },
					{ id: "f12", from: "notifyRejection", to: "end" },
				],
			},
		],
	},
}
