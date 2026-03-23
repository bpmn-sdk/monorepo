import type { TutorialManifest } from "../../lib/types.js"

const CLAIM_PROCESS_XML = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" xmlns:di="http://www.omg.org/spec/DD/20100524/DI" id="Definitions_1" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="InsuranceClaim" name="Insurance Claim" isExecutable="true">
    <bpmn:startEvent id="Start_1" name="Claim submitted">
      <bpmn:outgoing>Flow_1</bpmn:outgoing>
    </bpmn:startEvent>
    <bpmn:task id="Task_verify" name="Verify identity">
      <bpmn:incoming>Flow_1</bpmn:incoming>
      <bpmn:outgoing>Flow_2</bpmn:outgoing>
    </bpmn:task>
    <bpmn:task id="Task_review_policy" name="Review policy">
      <bpmn:incoming>Flow_2</bpmn:incoming>
      <bpmn:outgoing>Flow_3</bpmn:outgoing>
    </bpmn:task>
    <bpmn:task id="Task_assess" name="Assess damage">
      <bpmn:incoming>Flow_3</bpmn:incoming>
      <bpmn:outgoing>Flow_4</bpmn:outgoing>
    </bpmn:task>
    <bpmn:task id="Task_calculate" name="Calculate payout">
      <bpmn:incoming>Flow_4</bpmn:incoming>
      <bpmn:outgoing>Flow_5</bpmn:outgoing>
    </bpmn:task>
    <bpmn:task id="Task_approve" name="Get approval">
      <bpmn:incoming>Flow_5</bpmn:incoming>
      <bpmn:outgoing>Flow_6</bpmn:outgoing>
    </bpmn:task>
    <bpmn:task id="Task_pay" name="Process payment">
      <bpmn:incoming>Flow_6</bpmn:incoming>
      <bpmn:outgoing>Flow_7</bpmn:outgoing>
    </bpmn:task>
    <bpmn:task id="Task_notify" name="Notify claimant">
      <bpmn:incoming>Flow_7</bpmn:incoming>
      <bpmn:outgoing>Flow_8</bpmn:outgoing>
    </bpmn:task>
    <bpmn:endEvent id="End_1" name="Claim resolved">
      <bpmn:incoming>Flow_8</bpmn:incoming>
    </bpmn:endEvent>
    <bpmn:sequenceFlow id="Flow_1" sourceRef="Start_1" targetRef="Task_verify" />
    <bpmn:sequenceFlow id="Flow_2" sourceRef="Task_verify" targetRef="Task_review_policy" />
    <bpmn:sequenceFlow id="Flow_3" sourceRef="Task_review_policy" targetRef="Task_assess" />
    <bpmn:sequenceFlow id="Flow_4" sourceRef="Task_assess" targetRef="Task_calculate" />
    <bpmn:sequenceFlow id="Flow_5" sourceRef="Task_calculate" targetRef="Task_approve" />
    <bpmn:sequenceFlow id="Flow_6" sourceRef="Task_approve" targetRef="Task_pay" />
    <bpmn:sequenceFlow id="Flow_7" sourceRef="Task_pay" targetRef="Task_notify" />
    <bpmn:sequenceFlow id="Flow_8" sourceRef="Task_notify" targetRef="End_1" />
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="InsuranceClaim">
      <bpmndi:BPMNShape id="Start_1_di" bpmnElement="Start_1">
        <dc:Bounds x="152" y="102" width="36" height="36" />
        <bpmndi:BPMNLabel><dc:Bounds x="130" y="145" width="80" height="14" /></bpmndi:BPMNLabel>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_verify_di" bpmnElement="Task_verify">
        <dc:Bounds x="250" y="80" width="100" height="80" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_review_policy_di" bpmnElement="Task_review_policy">
        <dc:Bounds x="410" y="80" width="100" height="80" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_assess_di" bpmnElement="Task_assess">
        <dc:Bounds x="570" y="80" width="100" height="80" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_calculate_di" bpmnElement="Task_calculate">
        <dc:Bounds x="730" y="80" width="100" height="80" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_approve_di" bpmnElement="Task_approve">
        <dc:Bounds x="890" y="80" width="100" height="80" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_pay_di" bpmnElement="Task_pay">
        <dc:Bounds x="1050" y="80" width="100" height="80" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_notify_di" bpmnElement="Task_notify">
        <dc:Bounds x="1210" y="80" width="100" height="80" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="End_1_di" bpmnElement="End_1">
        <dc:Bounds x="1372" y="102" width="36" height="36" />
        <bpmndi:BPMNLabel><dc:Bounds x="1352" y="145" width="76" height="14" /></bpmndi:BPMNLabel>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNEdge id="Flow_1_di" bpmnElement="Flow_1">
        <di:waypoint x="188" y="120" /><di:waypoint x="250" y="120" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_2_di" bpmnElement="Flow_2">
        <di:waypoint x="350" y="120" /><di:waypoint x="410" y="120" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_3_di" bpmnElement="Flow_3">
        <di:waypoint x="510" y="120" /><di:waypoint x="570" y="120" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_4_di" bpmnElement="Flow_4">
        <di:waypoint x="670" y="120" /><di:waypoint x="730" y="120" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_5_di" bpmnElement="Flow_5">
        <di:waypoint x="830" y="120" /><di:waypoint x="890" y="120" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_6_di" bpmnElement="Flow_6">
        <di:waypoint x="990" y="120" /><di:waypoint x="1050" y="120" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_7_di" bpmnElement="Flow_7">
        <di:waypoint x="1150" y="120" /><di:waypoint x="1210" y="120" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_8_di" bpmnElement="Flow_8">
        <di:waypoint x="1310" y="120" /><di:waypoint x="1372" y="120" />
      </bpmndi:BPMNEdge>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`

export const tutorial: TutorialManifest = {
	id: "sub-processes",
	title: "Taming complexity with sub-processes",
	tagline: "Fold detail away — keep the big picture clean",
	description:
		"Real business processes have dozens of steps. Sub-processes let you group related tasks into a named box, hide the detail, and keep the top-level diagram readable. This tutorial covers embedded sub-processes, boundary events on sub-processes, and when to use them.",
	estimatedMinutes: 15,
	difficulty: "advanced",
	tags: ["bpmn", "sub-processes", "advanced", "organization", "no-install"],
	prerequisites: [],
	steps: [
		{
			id: "the-complexity-problem",
			title: "The complexity problem",
			mode: "web-editor",
			estimatedSeconds: 60,
			initialXml: CLAIM_PROCESS_XML,
			content: `## The complexity problem

This insurance claims process has 7 tasks in a row. Scroll right — it keeps going. By the time you reach the end you've forgotten how it started.

Now imagine this in a real enterprise: 30, 50, 100 tasks. Error paths, loops, parallel branches. The diagram becomes impossible to reason about.

### Run it — then reflect

Press **▶ Play** and watch the token crawl across all 7 steps.

**Ask yourself:** If someone asked you "what does this process do at a high level?" — could you tell them quickly from this diagram?

> 💡 A good BPMN diagram should communicate *intent* at a glance. If a diagram requires close reading to understand, it needs structure. Sub-processes are that structure.`,
			validation: {
				type: "manual",
				successMessage:
					"Exactly — 7 steps in a line tells us what happens but not why. Time to add structure.",
			},
			hints: [
				"Press ▶ Play to run through all 7 tasks",
				"Notice how long the process is horizontally — it's hard to see the big picture",
				"Think about which tasks belong together as a logical group",
			],
		},
		{
			id: "add-sub-process",
			title: "Add a sub-process",
			mode: "web-editor",
			estimatedSeconds: 150,
			content: `## Add a sub-process

A **sub-process** is a task that contains its own mini-process inside. From the outside it looks like a single step. From the inside, it's a complete flow.

The claim assessment work (reviewing policy, assessing damage, calculating payout, getting approval) is a natural group. Let's wrap it.

### How to add a sub-process

1. Find the **sub-process shape** in the palette — it looks like a rectangle with a small [+] marker at the bottom
2. Drag it onto the canvas, somewhere below the existing tasks (we'll rearrange later)
3. Make it large enough to hold several tasks — about 400×200 pixels
4. Name it **"Assess and approve claim"**

> 💡 Sub-processes can be **expanded** (you see the internals) or **collapsed** (just the named box with a + marker). We'll start expanded.`,
			validation: {
				type: "bpmnkit-element-count",
				elementType: "subProcess",
				min: 1,
				successMessage: "Sub-process added! Now we can move tasks into it.",
				errorMessage:
					"Find the sub-process shape in the palette (rectangle with a small + marker) and drag it onto the canvas.",
			},
			hints: [
				"Look for a rectangle shape with a small [+] icon at the bottom in the palette",
				"Drag it onto the canvas below the existing tasks",
				"Make it fairly large — it needs to contain multiple tasks",
				"Double-click it to name it 'Assess and approve claim'",
			],
		},
		{
			id: "populate-sub-process",
			title: "Move tasks into the sub-process",
			mode: "web-editor",
			estimatedSeconds: 180,
			content: `## Move tasks into the sub-process

Now drag the assessment tasks inside the sub-process. The tasks that logically belong together are:
- **Review policy**
- **Assess damage**
- **Calculate payout**
- **Get approval**

### How to move tasks in

1. **Click** one of the tasks to select it
2. **Drag it** into the sub-process boundary — it should snap inside
3. Repeat for each task that belongs in this group
4. Inside the sub-process, connect them with sequence flows (they'll need a mini start and end, or just flows connecting directly)

### Tip: work from outside in

After moving tasks in, you may need to delete the old connections between them and recreate connections inside the sub-process. The sub-process also needs a connection from "Verify identity" to its entry, and from its exit to "Process payment".

> 💡 You don't *have* to move existing tasks — you can also delete them and recreate them inside the sub-process. Sometimes that's faster.`,
			validation: {
				type: "manual",
				successMessage: "Sub-process populated! The top-level view is getting cleaner already.",
			},
			hints: [
				"Click a task to select it, then drag it into the sub-process box",
				"Tasks should snap into the sub-process when you drop them inside its boundary",
				"You may need to re-create sequence flows inside the sub-process",
				"Connect the sub-process to the rest of the process with sequence flows",
			],
		},
		{
			id: "add-boundary-on-subprocess",
			title: "Add a boundary event to the sub-process",
			mode: "web-editor",
			estimatedSeconds: 120,
			content: `## Add a boundary event to the sub-process

Sub-processes support boundary events just like regular tasks. If *anything* inside the sub-process fails, the boundary event catches it and routes to a recovery path — cancelling the entire sub-process cleanly.

This is much more powerful than handling errors inside: one boundary event on the sub-process replaces four individual error handlers on each internal task.

### What to do

1. **Hover over the sub-process boundary** (the outer edge of the sub-process box)
2. Click the **error boundary event** icon that appears (lightning bolt)
3. The boundary event attaches to the outer edge of the sub-process
4. Connect it to a new task: **"Escalate claim"**

> 💡 Sub-process error boundary events catch **any** unhandled BPMN error thrown inside — from any task at any nesting level. One boundary event protects the whole group.`,
			validation: {
				type: "bpmnkit-element-count",
				elementType: "boundaryEvent",
				min: 1,
				successMessage:
					"Boundary event on the sub-process — one handler protects all the tasks inside!",
				errorMessage:
					"Hover over the edge of the sub-process box to see boundary event handles, then click the error (lightning bolt) one.",
			},
			hints: [
				"Hover your mouse over the outer edge (boundary) of the sub-process box",
				"Look for small circle icons appearing — click the error (lightning bolt) one",
				"The boundary event appears on the outside edge of the sub-process",
				"Connect it to a new task like 'Escalate claim'",
			],
		},
		{
			id: "collapse-and-reflect",
			title: "Collapse and see the big picture",
			mode: "web-editor",
			estimatedSeconds: 90,
			content: `## Collapse and see the big picture

Now collapse the sub-process to see the clean top-level view.

### How to collapse

1. **Right-click** the sub-process
2. Choose **"Collapse sub-process"** (or similar option)
3. The sub-process shrinks to a single box with a [+] marker

### What you should see

The top-level process now reads:
**Claim submitted** → **Verify identity** → **[Assess and approve claim]** → **Process payment** → **Notify claimant** → **Claim resolved**

Seven steps becomes five — and the middle one tells you *what* it does without showing *how*.

### What you've learned

- ✓ Sub-processes group related tasks into a named unit
- ✓ They can be expanded (detail visible) or collapsed (summary view)
- ✓ Boundary events on sub-processes protect all internal tasks at once
- ✓ Good process design separates "what happens" from "how it happens"`,
			validation: {
				type: "manual",
				successMessage: "Clean, structured, readable — that's what professional BPMN looks like!",
			},
			hints: [
				"Right-click on the sub-process box to see the context menu",
				"Look for 'Collapse sub-process' or a similar option",
				"Once collapsed, notice how much cleaner the top-level view is",
			],
		},
	],
}
