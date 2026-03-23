import type { TutorialManifest } from "../../lib/types.js"

const LEAVE_REQUEST_XML = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" xmlns:di="http://www.omg.org/spec/DD/20100524/DI" id="Definitions_1" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="LeaveRequest" name="Leave Request" isExecutable="true">
    <bpmn:startEvent id="Start_1" name="Request submitted">
      <bpmn:outgoing>Flow_1</bpmn:outgoing>
    </bpmn:startEvent>
    <bpmn:task id="Task_submit" name="Submit request">
      <bpmn:incoming>Flow_1</bpmn:incoming>
      <bpmn:outgoing>Flow_2</bpmn:outgoing>
    </bpmn:task>
    <bpmn:task id="Task_review" name="Review request">
      <bpmn:incoming>Flow_2</bpmn:incoming>
      <bpmn:outgoing>Flow_3</bpmn:outgoing>
    </bpmn:task>
    <bpmn:endEvent id="End_1" name="Request approved">
      <bpmn:incoming>Flow_3</bpmn:incoming>
    </bpmn:endEvent>
    <bpmn:sequenceFlow id="Flow_1" sourceRef="Start_1" targetRef="Task_submit" />
    <bpmn:sequenceFlow id="Flow_2" sourceRef="Task_submit" targetRef="Task_review" />
    <bpmn:sequenceFlow id="Flow_3" sourceRef="Task_review" targetRef="End_1" />
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="LeaveRequest">
      <bpmndi:BPMNShape id="Start_1_di" bpmnElement="Start_1">
        <dc:Bounds x="152" y="102" width="36" height="36" />
        <bpmndi:BPMNLabel><dc:Bounds x="122" y="145" width="96" height="14" /></bpmndi:BPMNLabel>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_submit_di" bpmnElement="Task_submit">
        <dc:Bounds x="250" y="80" width="100" height="80" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_review_di" bpmnElement="Task_review">
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
	id: "gateways-decisions",
	title: "Decisions with gateways",
	tagline: "Model branching logic — what happens when the answer is no?",
	description:
		"Real processes rarely go in a straight line. Learn how exclusive gateways let your process make decisions, branch into different paths, and handle multiple outcomes — all without writing code.",
	estimatedMinutes: 8,
	difficulty: "beginner",
	tags: ["bpmn", "gateways", "decisions", "no-install"],
	prerequisites: [],
	steps: [
		{
			id: "the-problem",
			title: "A process that never says no",
			mode: "web-editor",
			estimatedSeconds: 60,
			initialXml: LEAVE_REQUEST_XML,
			content: `## A process that never says no

You're looking at a leave request process. An employee submits a request, someone reviews it, and it gets approved.

But wait — **what if the request is denied?** Right now this process has only one outcome: approved. Every run ends the same way.

### Run it and see

Press **▶ Play** and watch the token travel straight to "Request approved" — no matter what. This is a process that can't make decisions.

> 💡 In the real world, a reviewer might approve *or* reject a request. We need a way to model that choice.

When you're ready, click **"I see it"** to continue.`,
			validation: {
				type: "manual",
				successMessage: "Exactly — every request always gets approved. Time to fix that!",
			},
			hints: [
				"Press ▶ Play and watch the animated dot move through the process",
				"Notice the process always ends at 'Request approved' — there's no rejection path",
			],
		},
		{
			id: "add-gateway",
			title: "Add an exclusive gateway",
			mode: "web-editor",
			estimatedSeconds: 120,
			content: `## Add an exclusive gateway

An **exclusive gateway** (the diamond ◇ with an X) is BPMN's decision point. Exactly one outgoing path is taken — based on a condition you define.

Think of it like an if/else statement, but drawn as a diagram.

### How to add one

1. Find the **diamond shape** in the element palette (it may be labeled "Gateway" or shown as a ◇)
2. **Drag it** onto the canvas, positioned after "Review request"
3. Drop it between the review task and the end event

The diamond shape represents the moment where the reviewer makes their decision.

> 💡 **XOR gateway:** "Exclusive OR" — only one path can be taken. If approval = yes, go right. If no, go elsewhere.`,
			validation: {
				type: "bpmnkit-element-count",
				elementType: "exclusiveGateway",
				min: 1,
				successMessage: "Gateway added! Now let's give it a second outcome.",
				errorMessage:
					"Drag the diamond (gateway) shape from the palette onto the canvas after the review task.",
			},
			hints: [
				"Look for a diamond shape in the element palette on the left",
				"Drag the diamond onto the canvas and drop it to the right of 'Review request'",
				"The diamond represents a decision point where the process branches",
			],
		},
		{
			id: "add-rejection",
			title: "Add the rejection outcome",
			mode: "web-editor",
			estimatedSeconds: 120,
			content: `## Add the rejection outcome

A gateway with only one outgoing path isn't much of a decision. We need a **second end event** for the case where the request is rejected.

### What to do

1. **Add a new end event** (the thick circle) somewhere below or beside the existing end event
2. Connect the gateway to this new end event with a sequence flow (the arrow)
3. This represents the "Request rejected" outcome

Your process should now have two possible endings: one for approval, one for rejection.

> 💡 **End events** mark where a process path terminates. A process can have multiple end events for different outcomes — completed, cancelled, failed, etc.`,
			validation: {
				type: "bpmnkit-element-count",
				elementType: "endEvent",
				min: 2,
				successMessage: "Two outcomes — the process can now approve or reject!",
				errorMessage:
					"Add a second end event (thick circle) to the canvas and connect it from the gateway.",
			},
			hints: [
				"Drag a new end event (thick-bordered circle) from the palette onto the canvas",
				"Position it below or beside the existing 'Request approved' end event",
				"Connect the gateway to this new end event by dragging an arrow from gateway to end event",
			],
		},
		{
			id: "label-conditions",
			title: "Label the gateway conditions",
			mode: "web-editor",
			estimatedSeconds: 90,
			content: `## Label the gateway conditions

A gateway without labels is a mystery — which path is "yes" and which is "no"? **Condition labels** make the process self-documenting.

### How to label a sequence flow

1. **Double-click on an arrow** (sequence flow) coming out of the gateway
2. Type the condition: **"Approved"** for the path to the approved end event
3. Double-click the other outgoing arrow and type **"Rejected"**

### Also name your gateway

Double-click the diamond itself and give it a question name, like: **"Request approved?"**

> 💡 **Best practice:** Gateways should be named as questions. Outgoing flows should be named as answers: Yes/No, Approved/Rejected, Success/Failure.

When everything is labeled, click **"Done!"** below.`,
			validation: {
				type: "manual",
				successMessage:
					"Your process now models a real approval workflow — with decisions, branches, and clear labels!",
			},
			hints: [
				"Double-click on one of the arrows coming out of the gateway to edit its label",
				"Type 'Approved' for the path going to approval, 'Rejected' for the other",
				"Also double-click the gateway diamond itself to give it a name like 'Request approved?'",
			],
		},
	],
}
