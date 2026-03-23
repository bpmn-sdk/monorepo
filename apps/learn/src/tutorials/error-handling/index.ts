import type { TutorialManifest } from "../../lib/types.js"

const PAYMENT_XML = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" xmlns:di="http://www.omg.org/spec/DD/20100524/DI" id="Definitions_1" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="PaymentProcess" name="Payment Process" isExecutable="true">
    <bpmn:startEvent id="Start_1" name="Checkout initiated">
      <bpmn:outgoing>Flow_1</bpmn:outgoing>
    </bpmn:startEvent>
    <bpmn:serviceTask id="Task_charge" name="Charge credit card">
      <bpmn:incoming>Flow_1</bpmn:incoming>
      <bpmn:outgoing>Flow_2</bpmn:outgoing>
    </bpmn:serviceTask>
    <bpmn:task id="Task_receipt" name="Send receipt">
      <bpmn:incoming>Flow_2</bpmn:incoming>
      <bpmn:outgoing>Flow_3</bpmn:outgoing>
    </bpmn:task>
    <bpmn:endEvent id="End_1" name="Payment complete">
      <bpmn:incoming>Flow_3</bpmn:incoming>
    </bpmn:endEvent>
    <bpmn:sequenceFlow id="Flow_1" sourceRef="Start_1" targetRef="Task_charge" />
    <bpmn:sequenceFlow id="Flow_2" sourceRef="Task_charge" targetRef="Task_receipt" />
    <bpmn:sequenceFlow id="Flow_3" sourceRef="Task_receipt" targetRef="End_1" />
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="PaymentProcess">
      <bpmndi:BPMNShape id="Start_1_di" bpmnElement="Start_1">
        <dc:Bounds x="152" y="102" width="36" height="36" />
        <bpmndi:BPMNLabel><dc:Bounds x="124" y="145" width="92" height="14" /></bpmndi:BPMNLabel>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_charge_di" bpmnElement="Task_charge">
        <dc:Bounds x="250" y="80" width="100" height="80" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_receipt_di" bpmnElement="Task_receipt">
        <dc:Bounds x="410" y="80" width="100" height="80" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="End_1_di" bpmnElement="End_1">
        <dc:Bounds x="572" y="102" width="36" height="36" />
        <bpmndi:BPMNLabel><dc:Bounds x="548" y="145" width="84" height="14" /></bpmndi:BPMNLabel>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNEdge id="Flow_1_di" bpmnElement="Flow_1">
        <di:waypoint x="188" y="120" /><di:waypoint x="250" y="120" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_2_di" bpmnElement="Flow_2">
        <di:waypoint x="350" y="120" /><di:waypoint x="410" y="120" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_3_di" bpmnElement="Flow_3">
        <di:waypoint x="510" y="120" /><di:waypoint x="572" y="120" />
      </bpmndi:BPMNEdge>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`

export const tutorial: TutorialManifest = {
	id: "error-handling",
	title: "Handling failures gracefully",
	tagline: "What happens when things go wrong? Model it explicitly.",
	description:
		"Processes that only model the happy path are incomplete. Learn how boundary events let you catch errors, timeouts, and failures — and route them to a recovery path instead of leaving the process stuck.",
	estimatedMinutes: 12,
	difficulty: "intermediate",
	tags: ["bpmn", "errors", "boundary-events", "resilience", "no-install"],
	prerequisites: [],
	steps: [
		{
			id: "the-happy-path",
			title: "The unprotected happy path",
			mode: "web-editor",
			estimatedSeconds: 60,
			initialXml: PAYMENT_XML,
			content: `## The unprotected happy path

This payment process charges a credit card and sends a receipt. Run it — it works perfectly.

But what happens when the card is declined? Or when the payment API times out? Or when the card number is invalid?

### Run it and see

Press **▶ Play** and watch the process complete successfully. In simulation mode, tasks always succeed.

In production, **"Charge credit card" can fail**. If it does and we have no error handling, the process instance gets stuck. No error path, no notification, no retry — just a process sitting there indefinitely.

> 💡 A process that only models success is called a "happy path only" design. It's one of the most common BPMN mistakes. Always ask: what can go wrong here?`,
			validation: {
				type: "manual",
				successMessage: "Happy path runs fine — but we're not handling the unhappy path yet.",
			},
			hints: [
				"Press ▶ Play to run the process",
				"Notice it always completes successfully — that's the happy path",
				"Think: what should happen if the credit card charge fails?",
			],
		},
		{
			id: "boundary-events-explained",
			title: "Understanding boundary events",
			mode: "reading",
			estimatedSeconds: 90,
			content: `## Understanding boundary events

A **boundary event** sits on the edge of a task. It "catches" something that happens during task execution and diverts the flow to a recovery path.

### Types of boundary events

- **Error boundary** (lightning bolt) — catches a thrown BPMN error
- **Timer boundary** (clock) — fires after a timeout (e.g., "if no response in 5 minutes")
- **Message boundary** (envelope) — catches an incoming message during task execution

### Interrupting vs non-interrupting

- **Interrupting** (solid border) — cancels the task and takes the boundary path
- **Non-interrupting** (dashed border) — runs the boundary path *in parallel* without cancelling the task

### How it looks in BPMN

The boundary event appears as a small circle sitting on the edge of a task:

\`\`\`
┌─────────────┐
│ Charge card │
└──────◈──────┘
       │
   ⚡ Error
       │
  Handle failure
\`\`\`

> 💡 Boundary events are one of BPMN's most powerful features. They let you model error handling and timeouts visually — exactly where the risk is.`,
			validation: {
				type: "manual",
				successMessage: "Now you know the theory — time to add one!",
			},
			hints: ["Read through, then click to continue to the hands-on part"],
		},
		{
			id: "add-boundary-event",
			title: "Add an error boundary event",
			mode: "web-editor",
			estimatedSeconds: 150,
			content: `## Add an error boundary event

Let's protect "Charge credit card" with an error boundary event.

### How to add a boundary event

1. **Hover slowly** over the "Charge credit card" task
2. A small circle icon appears on the bottom edge of the task — that's the boundary event handle
3. **Click it** to place an error boundary event on the task

Alternatively:
1. Drag a boundary event shape from the palette
2. Drop it directly onto the task — it snaps to the boundary

The boundary event should appear as a small circle with a lightning bolt (⚡) sitting on the edge of the task.

> 💡 The event sits *on* the task, not beside it. This visual attachment makes it clear which task this error handling belongs to.`,
			validation: {
				type: "bpmnkit-element-count",
				elementType: "boundaryEvent",
				min: 1,
				successMessage: "Boundary event attached! Now route the error to a recovery task.",
				errorMessage:
					"Hover over the 'Charge credit card' task until boundary event handles appear, then click the error (lightning bolt) one.",
			},
			hints: [
				"Hover your mouse slowly over the 'Charge credit card' task",
				"Look for small circle icons appearing on the edge of the task",
				"Click the lightning bolt icon (error) to attach an error boundary event",
				"Alternatively, look in the palette for boundary event shapes",
			],
		},
		{
			id: "add-recovery-task",
			title: "Add a recovery task",
			mode: "web-editor",
			estimatedSeconds: 120,
			content: `## Add a recovery task

The boundary event catches the error — but then what? We need a task to handle the failure.

### What to do

1. **Drag a new task** from the palette onto the canvas, below "Charge credit card"
2. Name it **"Notify customer of failure"**
3. Connect the boundary event to this new task (drag an arrow from the boundary event circle to the task)

This task would, in production, send the customer an email explaining the payment failed and asking them to update their card.

> 💡 After a failure task, you'd typically connect to an **end event** — the process terminates on this path. You can add an end event after the recovery task to complete the error path.`,
			validation: {
				type: "bpmnkit-element-count",
				elementType: "task",
				min: 2,
				successMessage: "Recovery task added — the error path now has somewhere to go!",
				errorMessage:
					"Add a task below the payment task to handle the error (e.g. 'Notify customer of failure').",
			},
			hints: [
				"Drag a task (rectangle) from the palette and drop it below the 'Charge credit card' task",
				"Name it something like 'Notify customer of failure'",
				"Connect the boundary event to this task by dragging from the boundary event circle",
			],
		},
		{
			id: "complete-error-path",
			title: "Complete the error path",
			mode: "web-editor",
			estimatedSeconds: 90,
			content: `## Complete the error path

Connect the recovery task to an end event to complete the error handling path.

### What to do

1. **Add a new end event** after "Notify customer of failure"
2. Connect your recovery task to it
3. Optionally rename it **"Payment failed"** to distinguish it from "Payment complete"

### Your completed process

You now have two paths:
- **Happy path:** Charge card → Send receipt → Payment complete
- **Error path:** (error) → Notify customer → Payment failed

### What you've learned

- ✓ Boundary events intercept failures during task execution
- ✓ The error path is a first-class part of the process model
- ✓ Multiple end events represent different process outcomes
- ✓ Process models that handle errors are more trustworthy and maintainable`,
			validation: {
				type: "manual",
				successMessage:
					"Your process now handles both success and failure — that's production-ready design!",
			},
			hints: [
				"Add an end event (thick circle) after your recovery task",
				"Connect the recovery task to the end event",
				"Double-click the end event and name it 'Payment failed'",
			],
		},
	],
}
