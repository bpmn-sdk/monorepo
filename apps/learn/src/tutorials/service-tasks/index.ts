import type { TutorialManifest } from "../../lib/types.js"

const ORDER_PIPELINE_XML = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" xmlns:di="http://www.omg.org/spec/DD/20100524/DI" id="Definitions_1" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="OrderPipeline" name="Order Pipeline" isExecutable="true">
    <bpmn:startEvent id="Start_1" name="Order placed">
      <bpmn:outgoing>Flow_1</bpmn:outgoing>
    </bpmn:startEvent>
    <bpmn:task id="Task_receive" name="Receive order">
      <bpmn:incoming>Flow_1</bpmn:incoming>
      <bpmn:outgoing>Flow_2</bpmn:outgoing>
    </bpmn:task>
    <bpmn:endEvent id="End_1" name="Order processed">
      <bpmn:incoming>Flow_2</bpmn:incoming>
    </bpmn:endEvent>
    <bpmn:sequenceFlow id="Flow_1" sourceRef="Start_1" targetRef="Task_receive" />
    <bpmn:sequenceFlow id="Flow_2" sourceRef="Task_receive" targetRef="End_1" />
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="OrderPipeline">
      <bpmndi:BPMNShape id="Start_1_di" bpmnElement="Start_1">
        <dc:Bounds x="152" y="102" width="36" height="36" />
        <bpmndi:BPMNLabel><dc:Bounds x="136" y="145" width="70" height="14" /></bpmndi:BPMNLabel>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_receive_di" bpmnElement="Task_receive">
        <dc:Bounds x="250" y="80" width="100" height="80" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="End_1_di" bpmnElement="End_1">
        <dc:Bounds x="412" y="102" width="36" height="36" />
        <bpmndi:BPMNLabel><dc:Bounds x="390" y="145" width="80" height="14" /></bpmndi:BPMNLabel>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNEdge id="Flow_1_di" bpmnElement="Flow_1">
        <di:waypoint x="188" y="120" /><di:waypoint x="250" y="120" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_2_di" bpmnElement="Flow_2">
        <di:waypoint x="350" y="120" /><di:waypoint x="412" y="120" />
      </bpmndi:BPMNEdge>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`

export const tutorial: TutorialManifest = {
	id: "service-tasks",
	title: "Automating work with service tasks",
	tagline: "Connect your BPMN process to real software — no click required",
	description:
		"Service tasks are where BPMN meets real automation. Learn the difference between human tasks and automated work, how job workers pick up service tasks, and how to model an automated pipeline.",
	estimatedMinutes: 10,
	difficulty: "intermediate",
	tags: ["bpmn", "service-tasks", "automation", "camunda", "no-install"],
	prerequisites: [],
	steps: [
		{
			id: "what-are-service-tasks",
			title: "Human vs automated work",
			mode: "reading",
			estimatedSeconds: 90,
			content: `## Human vs automated work

BPMN has different shapes for different kinds of work:

- **Task** (plain rectangle) — generic work, type unspecified
- **User task** (person icon) — a human does this: fills a form, makes a decision
- **Service task** (gear icon) — **software does this automatically**, no human needed

### Service tasks in Camunda

When a process reaches a service task, Camunda publishes a **job** to a queue. A **job worker** — a piece of your code running somewhere — picks up that job, does the work, and completes it.

The process then continues automatically.

\`\`\`
Process Engine → publishes job → Job Worker → does work → completes job → process continues
\`\`\`

### Why this matters

Service tasks are the integration point between your process and your systems: APIs, databases, email providers, payment processors. Everything that should happen automatically goes in a service task.

> 💡 You don't need a running Camunda instance to model service tasks — you're just drawing the blueprint. The automation happens when you deploy and run it for real.`,
			validation: {
				type: "manual",
				successMessage: "Got it — service tasks are where your code connects to the process!",
			},
			hints: ["Read through the explanation, then click when you're ready to start modeling"],
		},
		{
			id: "add-first-service-task",
			title: "Add your first service task",
			mode: "web-editor",
			estimatedSeconds: 120,
			initialXml: ORDER_PIPELINE_XML,
			content: `## Add your first service task

The current process receives an order but doesn't validate it. Let's add a **service task** that automatically validates the order data — checking stock levels, verifying the customer, etc.

### How to add a service task

1. Find the **gear icon** shape in the element palette — that's the service task
2. Drag it onto the canvas, between "Receive order" and the end event
3. Name it **"Validate order"**

The gear icon distinguishes it visually from a plain task — anyone reading the diagram knows this step is automated.

> 💡 You can also right-click an existing task and choose **"Change type"** → Service Task to convert it.`,
			validation: {
				type: "bpmnkit-element-count",
				elementType: "serviceTask",
				min: 1,
				successMessage: "First service task added — your process now has automated validation!",
				errorMessage: "Drag the gear-icon shape (service task) from the palette onto the canvas.",
			},
			hints: [
				"Look for the shape with a gear/cog icon in the element palette",
				"Drag it between 'Receive order' and the end event",
				"Double-click it to name it 'Validate order'",
			],
		},
		{
			id: "add-second-service-task",
			title: "Add a payment service task",
			mode: "web-editor",
			estimatedSeconds: 120,
			content: `## Add a payment service task

Validated orders need to be paid for. Let's add another service task for **processing payment** — this would call your payment provider's API automatically.

### What to do

Add a second service task after "Validate order" and name it **"Process payment"**.

Your process is becoming a real automated pipeline:
1. Receive order (human/event-triggered)
2. Validate order (automated — checks stock, verifies data)
3. Process payment (automated — calls payment API)
4. Order processed (done!)

> 💡 A sequence of service tasks is an **automation chain** — the process orchestrates multiple systems without any human involvement. This is the core of Camunda's value for microservice architectures.`,
			validation: {
				type: "bpmnkit-element-count",
				elementType: "serviceTask",
				min: 2,
				successMessage: "Two service tasks — you've modeled an automated payment pipeline!",
				errorMessage: "Add a second service task (gear icon) for payment processing.",
			},
			hints: [
				"Drag another service task (gear icon) from the palette",
				"Place it after the first service task",
				"Name it 'Process payment'",
			],
		},
		{
			id: "connect-pipeline",
			title: "Connect the pipeline",
			mode: "web-editor",
			estimatedSeconds: 90,
			content: `## Connect the pipeline

Make sure all your tasks are connected in the right order. Each step should flow into the next.

### Check your connections

The complete flow should be:

**Order placed** → **Receive order** → **Validate order** → **Process payment** → **Order processed**

If any arrows are missing, hover over a task until the blue arrow handle appears, then drag it to the next task.

### Also: delete old connections

If the original arrow from "Receive order" still goes directly to the end event, **delete it** — it bypasses your new service tasks. Click the arrow and press Delete.

> 💡 Use the toolbar's **▶ Play** button to verify the process runs correctly end to end.`,
			validation: {
				type: "manual",
				successMessage: "Pipeline connected and ready to run!",
			},
			hints: [
				"Hover over each task to see the blue arrow handles",
				"Drag arrows between tasks to create connections",
				"If there's a stray arrow that skips your new tasks, click it and press Delete",
			],
		},
		{
			id: "run-automated",
			title: "Run the automated pipeline",
			mode: "web-editor",
			estimatedSeconds: 60,
			content: `## Run the automated pipeline

Press **▶ Play** and watch your order pipeline execute from start to finish automatically.

### What you've built

A process where:
- Each service task represents a call to an external system
- The engine orchestrates the sequence — no manual coordination needed
- If any step fails, the engine knows where the process stopped

### What you've learned

- ✓ Service tasks represent automated work done by job workers
- ✓ The gear icon visually distinguishes automation from human work
- ✓ Chaining service tasks creates a fully automated pipeline
- ✓ The process engine tracks exactly where execution is at all times

In a real deployment, each service task would have a **job type** configured — a string like \`"validate-order"\` that your job worker subscribes to.`,
			validation: {
				type: "manual",
				successMessage:
					"Automated pipeline complete! In production this would call real APIs and services.",
			},
			hints: [
				"Press ▶ Play to run the process",
				"Watch the token move automatically through all service tasks",
				"The process completes without any human input — that's full automation",
			],
		},
	],
}
