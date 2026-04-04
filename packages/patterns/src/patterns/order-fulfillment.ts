import type { Pattern } from "../types.js"

export const orderFulfillment: Pattern = {
	id: "order-fulfillment",
	name: "Order Fulfillment",
	description: "E-commerce/supply chain workflow from order placement to delivery confirmation",
	keywords: [
		"order",
		"fulfillment",
		"e-commerce",
		"ecommerce",
		"shipping",
		"warehouse",
		"inventory",
		"delivery",
		"logistics",
		"dispatch",
		"pick and pack",
	],
	readme: `## Order Fulfillment

Operational workflow that takes an order from placement through payment validation,
warehouse pick & pack, shipping, and delivery confirmation.

### Key phases
1. **Order validation**: verify items in stock, customer details, delivery address
2. **Payment processing**: authorise and capture payment
3. **Warehouse**: pick items, pack, generate shipping label
4. **Shipping**: hand off to carrier, track shipment
5. **Delivery confirmation**: confirm delivery, trigger post-purchase flow

### Key considerations
- **Inventory reservation**: reserve stock at order placement, release if payment fails
- **Split shipments**: order may ship from multiple warehouses; each shipment is a sub-process
- **Payment capture timing**: authorise at order placement, capture when order ships
- **Address validation**: validate delivery address before committing warehouse resources
- **Returns/reverse logistics**: design the forward flow with reversal in mind
- **SLA tracking**: warehouse SLA (e.g. same-day if ordered by 2pm), carrier SLA (1–5 business days)
- **Fraud screening**: screen for card fraud before payment capture`,

	workers: [
		{
			name: "validate-inventory",
			jobType: "com.example:inventory:check:1",
			description: "Check real-time stock availability for all ordered items",
			inputs: {
				lineItems: "array of { skuId, quantity }",
				warehouseId: "string (optional — preferred warehouse)",
			},
			outputs: {
				allAvailable: "boolean",
				availability: "array of { skuId, available, warehouseId }",
				estimatedShipDate: "string",
			},
			externalApis: ["Shopify", "WooCommerce", "SAP", "NetSuite", "Linnworks"],
		},
		{
			name: "process-payment",
			jobType: "com.example:payment:charge:1",
			description: "Authorise and capture customer payment",
			inputs: {
				paymentMethodId: "string",
				amount: "number",
				currency: "string",
				orderId: "string",
			},
			outputs: {
				paymentId: "string",
				status: "string — succeeded | failed | requires_action",
				failureReason: "string (if failed)",
			},
			externalApis: ["Stripe", "Adyen", "Braintree", "PayPal", "Square"],
		},
		{
			name: "create-warehouse-order",
			jobType: "com.example:warehouse:create-order:1",
			description: "Send pick-and-pack instruction to warehouse management system",
			inputs: {
				orderId: "string",
				lineItems: "array of { skuId, quantity }",
				warehouseId: "string",
				shippingMethod: "string",
			},
			outputs: {
				warehouseOrderId: "string",
				estimatedReadyAt: "string",
			},
			externalApis: ["ShipBob", "Fulfillment by Amazon", "ShipHero", "Deposco"],
		},
		{
			name: "create-shipment",
			jobType: "com.example:shipping:create:1",
			description: "Generate shipping label and book carrier pickup",
			inputs: {
				orderId: "string",
				warehouseId: "string",
				deliveryAddress: "object",
				shippingMethod: "string",
				packageWeight: "number",
				packageDimensions: "object",
			},
			outputs: {
				trackingNumber: "string",
				carrier: "string",
				labelUrl: "string",
				estimatedDeliveryDate: "string",
			},
			externalApis: ["EasyPost", "Shippo", "ShipStation", "FedEx API", "UPS API", "DHL API"],
		},
		{
			name: "send-tracking-notification",
			jobType: "io.bpmnkit:email:send:1",
			description: "Email customer with tracking number and estimated delivery date",
			inputs: {
				to: "string",
				subject: "string",
				body: "string",
			},
			outputs: {},
		},
	],

	variations: `## Common variations

### Split shipments
If items are in different warehouses, use a parallel multi-instance sub-process —
one instance per warehouse location. Join after all shipments are dispatched.

### Pre-order / backorder
If an item is out of stock, add a path to queue the order and wait for restocking
using an intermediate message catch event from the inventory system.

### Fraud screening
Insert a fraud-check service task (Stripe Radar, Kount, Signifyd) between order
validation and payment. Cancel on high fraud score.

### Click-and-collect
Add a parallel gateway after warehouse pick: one path for standard shipping, one for
store pickup notification. Both paths converge at delivery confirmation.`,

	template: {
		id: "order-fulfillment",
		processes: [
			{
				id: "Process_orderFulfillment",
				name: "Order Fulfillment",
				elements: [
					{ id: "start", type: "startEvent", name: "Order Placed" },
					{
						id: "validateInventory",
						type: "serviceTask",
						name: "Validate Inventory",
						jobType: "com.example:inventory:check:1",
					},
					{ id: "stockGw", type: "exclusiveGateway", name: "All In Stock?" },
					{
						id: "notifyOutOfStock",
						type: "serviceTask",
						name: "Notify Out of Stock",
						jobType: "io.bpmnkit:email:send:1",
					},
					{
						id: "processPayment",
						type: "serviceTask",
						name: "Process Payment",
						jobType: "com.example:payment:charge:1",
					},
					{ id: "paymentGw", type: "exclusiveGateway", name: "Payment OK?" },
					{
						id: "notifyPaymentFailed",
						type: "serviceTask",
						name: "Notify Payment Failed",
						jobType: "io.bpmnkit:email:send:1",
					},
					{
						id: "createWarehouseOrder",
						type: "serviceTask",
						name: "Create Warehouse Order",
						jobType: "com.example:warehouse:create-order:1",
					},
					{ id: "pickAndPack", type: "userTask", name: "Pick & Pack" },
					{
						id: "createShipment",
						type: "serviceTask",
						name: "Create Shipment",
						jobType: "com.example:shipping:create:1",
					},
					{
						id: "sendTracking",
						type: "serviceTask",
						name: "Send Tracking Email",
						jobType: "io.bpmnkit:email:send:1",
					},
					{ id: "end", type: "endEvent", name: "Order Shipped" },
					{ id: "endFailed", type: "endEvent", name: "Order Cancelled" },
				],
				flows: [
					{ id: "f1", from: "start", to: "validateInventory" },
					{ id: "f2", from: "validateInventory", to: "stockGw" },
					{
						id: "f3",
						from: "stockGw",
						to: "processPayment",
						name: "Yes",
						condition: "= allAvailable = true",
					},
					{ id: "f4", from: "stockGw", to: "notifyOutOfStock", name: "No" },
					{ id: "f5", from: "notifyOutOfStock", to: "endFailed" },
					{ id: "f6", from: "processPayment", to: "paymentGw" },
					{
						id: "f7",
						from: "paymentGw",
						to: "createWarehouseOrder",
						name: "Success",
						condition: '= status = "succeeded"',
					},
					{ id: "f8", from: "paymentGw", to: "notifyPaymentFailed", name: "Failed" },
					{ id: "f9", from: "notifyPaymentFailed", to: "endFailed" },
					{ id: "f10", from: "createWarehouseOrder", to: "pickAndPack" },
					{ id: "f11", from: "pickAndPack", to: "createShipment" },
					{ id: "f12", from: "createShipment", to: "sendTracking" },
					{ id: "f13", from: "sendTracking", to: "end" },
				],
			},
		],
	},
}
