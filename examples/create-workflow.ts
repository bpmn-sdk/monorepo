/**
 * Example: Create a BPMN workflow programmatically using @bpmn-sdk/core
 *
 * This script builds an order-processing workflow with:
 * - A start event triggered by an incoming order
 * - A service task to validate the order
 * - An exclusive gateway to route valid vs. invalid orders
 * - A parallel gateway to run payment + inventory checks concurrently
 * - A user task for manual review
 * - REST connector to notify an external system
 * - A sub-process for shipping
 * - End events for success and rejection
 *
 * Run: npx tsx examples/create-workflow.ts
 */

import { Bpmn } from "../packages/bpmn-sdk/src/index.js";

// ---------------------------------------------------------------------------
// 1. Build the process using the fluent API
// ---------------------------------------------------------------------------

// `.withAutoLayout()` is opt-in: without it, `build()` produces valid BPMN but
// no visual layout (diagrams: []). The layout engine uses overlap detection, so
// very dense workflows may require manual DI adjustments after export.
const definitions = Bpmn.createProcess("OrderProcessing")
	.withAutoLayout()
	.name("Order Processing Workflow")
	.versionTag("1.0.0")

	// ── Start ──
	.startEvent("start", { name: "Order Received" })

	// ── Validate ──
	.serviceTask("validate", {
		name: "Validate Order",
		taskType: "order-validation",
		retries: "3",
		ioMapping: {
			inputs: [{ source: "=order", target: "orderData" }],
			outputs: [{ source: "=valid", target: "isValid" }],
		},
	})

	// ── Decision gateway ──
	.exclusiveGateway("checkValid", { name: "Order Valid?" })

	// Branch: invalid order → reject
	.branch("Invalid", (b) =>
		b
			.condition("=isValid = false")
			.serviceTask("notifyRejection", {
				name: "Send Rejection Email",
				taskType: "email-sender",
				taskHeaders: { template: "order-rejected" },
			})
			.endEvent("endRejected", { name: "Order Rejected" }),
	)

	// Branch: valid order → continue processing
	.branch("Valid", (b) => b.condition("=isValid = true").connectTo("parallelStart"))

	// ── Parallel processing ──
	.parallelGateway("parallelStart", { name: "Start Parallel" })

	.branch("Payment", (b) =>
		b
			.serviceTask("processPayment", {
				name: "Process Payment",
				taskType: "payment-processor",
				retries: "5",
			})
			.connectTo("parallelEnd"),
	)

	.branch("Inventory", (b) =>
		b
			.scriptTask("checkInventory", {
				name: "Check Inventory",
				expression: "=inventory[item = order.itemId].quantity > 0",
				resultVariable: "inStock",
			})
			.connectTo("parallelEnd"),
	)

	.parallelGateway("parallelEnd", { name: "All Complete" })

	// ── Manual review ──
	.userTask("manualReview", {
		name: "Manager Approval",
		formId: "order-approval-form",
	})

	// ── REST connector: notify external system ──
	.restConnector("notifyERP", {
		name: "Notify ERP System",
		method: "POST",
		url: '=erpBaseUrl + "/api/orders"',
		authentication: { type: "bearer", token: "=secrets.ERP_TOKEN" },
		body: '={orderId: order.id, status: "approved"}',
		resultVariable: "erpResponse",
	})

	// ── Shipping sub-process ──
	.subProcess(
		"shippingSubProcess",
		(sub) => {
			sub
				.startEvent("shipStart")
				.serviceTask("createLabel", {
					name: "Create Shipping Label",
					taskType: "shipping-label",
				})
				.serviceTask("dispatchOrder", {
					name: "Dispatch Order",
					taskType: "dispatch",
				})
				.endEvent("shipEnd");
		},
		{ name: "Handle Shipping" },
	)

	// ── Done ──
	.endEvent("endSuccess", { name: "Order Fulfilled" })
	.build();

// ---------------------------------------------------------------------------
// 2. Export to BPMN XML
// ---------------------------------------------------------------------------

const xml = Bpmn.export(definitions);

console.log(xml);
// console.log();
// console.log(`Process: ${definitions.processes[0]?.name}`);
// console.log(`Elements: ${definitions.processes[0]?.flowElements.length}`);
// console.log(`Flows: ${definitions.processes[0]?.sequenceFlows.length}`);
