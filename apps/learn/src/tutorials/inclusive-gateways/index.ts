import type { TutorialManifest } from "../../lib/types.js"

const PRODUCT_LAUNCH_XML = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" xmlns:di="http://www.omg.org/spec/DD/20100524/DI" id="Definitions_1" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="ProductLaunch" name="Product Launch" isExecutable="true">
    <bpmn:startEvent id="Start_1" name="Feature ready">
      <bpmn:outgoing>Flow_1</bpmn:outgoing>
    </bpmn:startEvent>
    <bpmn:task id="Task_plan" name="Plan launch">
      <bpmn:incoming>Flow_1</bpmn:incoming>
      <bpmn:outgoing>Flow_2</bpmn:outgoing>
    </bpmn:task>
    <bpmn:endEvent id="End_1" name="Launch complete">
      <bpmn:incoming>Flow_2</bpmn:incoming>
    </bpmn:endEvent>
    <bpmn:sequenceFlow id="Flow_1" sourceRef="Start_1" targetRef="Task_plan" />
    <bpmn:sequenceFlow id="Flow_2" sourceRef="Task_plan" targetRef="End_1" />
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="ProductLaunch">
      <bpmndi:BPMNShape id="Start_1_di" bpmnElement="Start_1">
        <dc:Bounds x="152" y="102" width="36" height="36" />
        <bpmndi:BPMNLabel><dc:Bounds x="138" y="145" width="64" height="14" /></bpmndi:BPMNLabel>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_plan_di" bpmnElement="Task_plan">
        <dc:Bounds x="250" y="80" width="100" height="80" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="End_1_di" bpmnElement="End_1">
        <dc:Bounds x="412" y="102" width="36" height="36" />
        <bpmndi:BPMNLabel><dc:Bounds x="390" y="145" width="82" height="14" /></bpmndi:BPMNLabel>
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
	id: "inclusive-gateways",
	title: "Flexible branching with inclusive gateways",
	tagline: "When 'one or more paths' is the answer — the OR gateway",
	description:
		"Exclusive gateways pick exactly one path. Parallel gateways take all paths. But sometimes you need something in between: take this path, that path, or both — depending on conditions. That's the inclusive gateway.",
	estimatedMinutes: 10,
	difficulty: "intermediate",
	tags: ["bpmn", "gateways", "inclusive", "or-gateway", "no-install"],
	prerequisites: [],
	steps: [
		{
			id: "gateway-comparison",
			title: "Three gateways, three behaviors",
			mode: "reading",
			estimatedSeconds: 90,
			content: `## Three gateways, three behaviors

You've probably seen exclusive and parallel gateways. Here's how all three compare:

| Gateway | Symbol | Takes | When to use |
|---------|--------|-------|-------------|
| **Exclusive** | ◇ (X) | Exactly **one** path | If/else decisions |
| **Parallel** | ◇ (+) | **All** paths | Always do everything concurrently |
| **Inclusive** | ◇ (O) | **One or more** paths | Conditional multi-path |

### The inclusive gateway (OR gateway)

An inclusive gateway evaluates **every** outgoing condition. Each condition that is true activates that path. Zero to all paths can be taken.

### A real example: product launch notifications

When launching a product, the team needs to:
- **Always:** Update the changelog
- **If external customers affected:** Send customer email
- **If a blog post exists:** Publish the blog
- **If a premium feature:** Notify enterprise customers

Some launches trigger one notification. Others trigger three. An exclusive gateway can't model this — an inclusive gateway can.

> 💡 Inclusive gateways also need a **join**. Like parallel joins, they wait for all activated paths to complete before continuing.`,
			validation: {
				type: "manual",
				successMessage: "Got it — inclusive gateways handle conditional multi-path logic!",
			},
			hints: ["Read through the comparison, then click to start building"],
		},
		{
			id: "add-inclusive-gateway",
			title: "Add an inclusive gateway",
			mode: "web-editor",
			estimatedSeconds: 120,
			initialXml: PRODUCT_LAUNCH_XML,
			content: `## Add an inclusive gateway

After "Plan launch," the team decides which notification channels to activate. This is the perfect spot for an inclusive gateway.

### How to add one

1. Find the **diamond with an O** (circle) in the element palette — that's the inclusive gateway
2. Drag it onto the canvas, positioned after "Plan launch"
3. It represents the branching point: "which notifications do we need?"

The O inside the diamond distinguishes it from:
- X = exclusive (pick one)
- + = parallel (pick all)
- O = inclusive (pick one or more)

> 💡 If you can't find the inclusive gateway specifically, drag any gateway and right-click → Change type → Inclusive Gateway.`,
			validation: {
				type: "bpmnkit-element-count",
				elementType: "inclusiveGateway",
				min: 1,
				successMessage: "Inclusive gateway added — now build the notification branches!",
				errorMessage:
					"Find the diamond with a circle (O) in the palette — that's the inclusive gateway.",
			},
			hints: [
				"Look for a diamond shape with a circle (O) inside it in the palette",
				"Drag it onto the canvas after 'Plan launch'",
				"If you can't find it, drag any gateway, right-click it, and choose 'Change type' → Inclusive Gateway",
			],
		},
		{
			id: "add-notification-tasks",
			title: "Add notification tasks",
			mode: "web-editor",
			estimatedSeconds: 150,
			content: `## Add notification tasks

Add three notification tasks that will branch from the inclusive gateway. Each represents a channel that *might* be activated.

### Tasks to add

1. **"Send customer email"** — for external-facing releases
2. **"Publish blog post"** — if blog content exists
3. **"Update changelog"** — always done (we'll handle that with conditions later)

Drag three task shapes from the palette and position them above, inline, and below the gateway to give each branch visual space.

> 💡 With three outgoing paths from an inclusive gateway, between 1 and 3 of them will activate per run. The conditions on each arrow determine which.`,
			validation: {
				type: "bpmnkit-element-count",
				elementType: "task",
				min: 4,
				successMessage: "Three notification tasks added — now connect and join them!",
				errorMessage: "Add three task shapes (rectangles) to represent the notification channels.",
			},
			hints: [
				"Drag three task shapes from the palette",
				"Name them: 'Send customer email', 'Publish blog post', 'Update changelog'",
				"Position them spread out vertically to give visual space for the three branches",
			],
		},
		{
			id: "add-join-gateway",
			title: "Add the inclusive join",
			mode: "web-editor",
			estimatedSeconds: 120,
			content: `## Add the inclusive join

After the notifications, the process continues. We need a **second inclusive gateway** to synchronize: wait for all *activated* paths to complete before moving on.

### What to do

1. Drag another **inclusive gateway** (O diamond) onto the canvas, after all three notification tasks
2. Connect each notification task to this join gateway
3. Connect the join gateway to a new task: **"Close launch ticket"**

### Why we need the join

If the inclusive split activates 2 out of 3 paths, the join waits for exactly those 2 to complete. It ignores the unactivated path entirely.

> 💡 An inclusive join that receives a token from each *active* upstream path is called a **"merging inclusive gateway"**. It's smarter than a parallel join (which always waits for everything).`,
			validation: {
				type: "bpmnkit-element-count",
				elementType: "inclusiveGateway",
				min: 2,
				successMessage: "Split and join in place — the inclusive pattern is complete!",
				errorMessage:
					"Add a second inclusive gateway (O diamond) to join all notification paths back together.",
			},
			hints: [
				"Drag another inclusive gateway (O diamond) to the right of all three notification tasks",
				"Connect each notification task to this join gateway",
				"Connect the join to a final task like 'Close launch ticket'",
			],
		},
		{
			id: "run-and-reflect",
			title: "Run the flexible launch process",
			mode: "web-editor",
			estimatedSeconds: 60,
			content: `## Run the flexible launch process

Press **▶ Play** to run the process. In simulation mode, all activated conditions default to true — so all three paths will activate.

### What you've learned

- ✓ **Exclusive gateways** pick exactly one path (if/else)
- ✓ **Parallel gateways** always take all paths (concurrent)
- ✓ **Inclusive gateways** take one or more paths based on conditions (OR logic)
- ✓ Every split gateway needs a matching join to synchronize

### When to use each

- Use **exclusive** when the paths are mutually exclusive (paid vs free tier)
- Use **parallel** when everything always happens (notify + log + audit)
- Use **inclusive** when any subset might happen (optional channels, optional steps)`,
			validation: {
				type: "manual",
				successMessage:
					"You've mastered all three gateway types — the most powerful decision-modeling tool in BPMN!",
			},
			hints: [
				"Press ▶ Play to run the process",
				"In simulation all conditions are true, so all paths should activate",
				"Think about what conditions you'd put on each outgoing flow in production",
			],
		},
	],
}
