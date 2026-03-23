import type { TutorialManifest } from "../../lib/types.js"

const PARALLEL_FULFILLMENT_XML = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" xmlns:di="http://www.omg.org/spec/DD/20100524/DI" id="Definitions_1" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="OrderFulfillment" name="Order Fulfillment" isExecutable="true">
    <bpmn:startEvent id="Start_1" name="Order received">
      <bpmn:outgoing>Flow_1</bpmn:outgoing>
    </bpmn:startEvent>
    <bpmn:parallelGateway id="GW_split" name="">
      <bpmn:incoming>Flow_1</bpmn:incoming>
      <bpmn:outgoing>Flow_pack</bpmn:outgoing>
      <bpmn:outgoing>Flow_label</bpmn:outgoing>
    </bpmn:parallelGateway>
    <bpmn:task id="Task_pack" name="Pack items">
      <bpmn:incoming>Flow_pack</bpmn:incoming>
      <bpmn:outgoing>Flow_pack_join</bpmn:outgoing>
    </bpmn:task>
    <bpmn:task id="Task_label" name="Label package">
      <bpmn:incoming>Flow_label</bpmn:incoming>
      <bpmn:outgoing>Flow_label_join</bpmn:outgoing>
    </bpmn:task>
    <bpmn:parallelGateway id="GW_join" name="">
      <bpmn:incoming>Flow_pack_join</bpmn:incoming>
      <bpmn:incoming>Flow_label_join</bpmn:incoming>
      <bpmn:outgoing>Flow_ship</bpmn:outgoing>
    </bpmn:parallelGateway>
    <bpmn:task id="Task_ship" name="Ship order">
      <bpmn:incoming>Flow_ship</bpmn:incoming>
      <bpmn:outgoing>Flow_end</bpmn:outgoing>
    </bpmn:task>
    <bpmn:endEvent id="End_1" name="Order shipped">
      <bpmn:incoming>Flow_end</bpmn:incoming>
    </bpmn:endEvent>
    <bpmn:sequenceFlow id="Flow_1" sourceRef="Start_1" targetRef="GW_split" />
    <bpmn:sequenceFlow id="Flow_pack" sourceRef="GW_split" targetRef="Task_pack" />
    <bpmn:sequenceFlow id="Flow_label" sourceRef="GW_split" targetRef="Task_label" />
    <bpmn:sequenceFlow id="Flow_pack_join" sourceRef="Task_pack" targetRef="GW_join" />
    <bpmn:sequenceFlow id="Flow_label_join" sourceRef="Task_label" targetRef="GW_join" />
    <bpmn:sequenceFlow id="Flow_ship" sourceRef="GW_join" targetRef="Task_ship" />
    <bpmn:sequenceFlow id="Flow_end" sourceRef="Task_ship" targetRef="End_1" />
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="OrderFulfillment">
      <bpmndi:BPMNShape id="Start_1_di" bpmnElement="Start_1">
        <dc:Bounds x="152" y="182" width="36" height="36" />
        <bpmndi:BPMNLabel><dc:Bounds x="130" y="225" width="80" height="14" /></bpmndi:BPMNLabel>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="GW_split_di" bpmnElement="GW_split">
        <dc:Bounds x="260" y="175" width="50" height="50" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_pack_di" bpmnElement="Task_pack">
        <dc:Bounds x="380" y="100" width="100" height="80" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_label_di" bpmnElement="Task_label">
        <dc:Bounds x="380" y="280" width="100" height="80" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="GW_join_di" bpmnElement="GW_join">
        <dc:Bounds x="540" y="175" width="50" height="50" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_ship_di" bpmnElement="Task_ship">
        <dc:Bounds x="660" y="160" width="100" height="80" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="End_1_di" bpmnElement="End_1">
        <dc:Bounds x="820" y="182" width="36" height="36" />
        <bpmndi:BPMNLabel><dc:Bounds x="800" y="225" width="76" height="14" /></bpmndi:BPMNLabel>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNEdge id="Flow_1_di" bpmnElement="Flow_1">
        <di:waypoint x="188" y="200" /><di:waypoint x="260" y="200" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_pack_di" bpmnElement="Flow_pack">
        <di:waypoint x="285" y="175" /><di:waypoint x="285" y="140" /><di:waypoint x="380" y="140" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_label_di" bpmnElement="Flow_label">
        <di:waypoint x="285" y="225" /><di:waypoint x="285" y="320" /><di:waypoint x="380" y="320" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_pack_join_di" bpmnElement="Flow_pack_join">
        <di:waypoint x="480" y="140" /><di:waypoint x="565" y="140" /><di:waypoint x="565" y="175" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_label_join_di" bpmnElement="Flow_label_join">
        <di:waypoint x="480" y="320" /><di:waypoint x="565" y="320" /><di:waypoint x="565" y="225" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_ship_di" bpmnElement="Flow_ship">
        <di:waypoint x="590" y="200" /><di:waypoint x="660" y="200" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_end_di" bpmnElement="Flow_end">
        <di:waypoint x="760" y="200" /><di:waypoint x="820" y="200" />
      </bpmndi:BPMNEdge>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`

export const tutorial: TutorialManifest = {
	id: "parallel-work",
	title: "Running tasks in parallel",
	tagline: "Do more at once — model concurrent work with parallel gateways",
	description:
		"Not every step has to wait for the previous one. Learn how parallel gateways let you fan out work across multiple simultaneous paths, then synchronize before moving on.",
	estimatedMinutes: 8,
	difficulty: "beginner",
	tags: ["bpmn", "gateways", "parallel", "no-install"],
	prerequisites: [],
	steps: [
		{
			id: "observe-parallel",
			title: "See parallelism in action",
			mode: "web-editor",
			estimatedSeconds: 60,
			initialXml: PARALLEL_FULFILLMENT_XML,
			content: `## See parallelism in action

This order fulfillment process has two tasks that run **at the same time**: packing the items and printing the label. They don't need to wait for each other.

The **parallel gateway** (the diamond with a + sign) is BPMN's way of saying: "start all of these paths simultaneously."

### Run it and watch

Press **▶ Play** and observe:
- The process **splits** into two paths at the first gateway
- **Both** "Pack items" and "Label package" get tokens simultaneously
- The second gateway **waits** until both paths are done before continuing
- Only then does "Ship order" proceed

> 💡 In real systems, parallel gateways represent actual concurrent execution — multiple workers, threads, or services running at the same time.`,
			validation: {
				type: "manual",
				successMessage: "You saw both paths activate at once — that's true parallelism!",
			},
			hints: [
				"Press ▶ Play and watch carefully — you should see two animated tokens appear at the split",
				"Both 'Pack items' and 'Label package' should be active simultaneously",
				"The join gateway waits until both tasks are done before continuing",
			],
		},
		{
			id: "add-third-task",
			title: "Add a third parallel task",
			mode: "web-editor",
			estimatedSeconds: 120,
			content: `## Add a third parallel task

Packing and labeling happen in parallel — but what about generating the invoice? That can also happen at the same time, independently.

Let's add a **third parallel path** to the process.

### What to do

1. Drag a new **task** from the palette onto the canvas
2. Position it between the two gateways (above or below the existing tasks)
3. Name it **"Generate invoice"**

In the next step you'll connect it to both gateways.

> 💡 Parallel gateways can have any number of outgoing paths — three, five, ten. All paths activate simultaneously and the join waits for all of them.`,
			validation: {
				type: "bpmnkit-element-count",
				elementType: "task",
				min: 4,
				successMessage: "Third task added! Now connect it to complete the parallel branch.",
				errorMessage:
					"Drag a new task (rectangle) from the palette and place it between the two gateways.",
			},
			hints: [
				"Drag a task (rectangle) from the palette onto the canvas",
				"Position it between the two gateway diamonds, above or below the existing tasks",
				"Double-click it and name it 'Generate invoice'",
			],
		},
		{
			id: "connect-third-task",
			title: "Wire the new path",
			mode: "web-editor",
			estimatedSeconds: 120,
			content: `## Wire the new path

Your new task needs to be connected to both gateways to become part of the parallel execution.

### Two connections to make

1. **Hover** over the parallel split gateway (first +) → drag an arrow to your new task
2. **Hover** over your new task → drag an arrow to the parallel join gateway (second +)

Once connected, the split will activate your task alongside the other two, and the join will wait for all three before shipping.

> 💡 The join gateway is a synchronization point — it blocks until every incoming path has a token. Miss one connection and the process will hang forever waiting.`,
			validation: {
				type: "manual",
				successMessage: "Three-way parallel flow — all three tasks will now run simultaneously!",
			},
			hints: [
				"Hover over the first gateway (split +) until a blue arrow appears on its edge",
				"Drag from that arrow to your new 'Generate invoice' task",
				"Then hover over the new task and drag an arrow from it to the second gateway (join +)",
			],
		},
		{
			id: "run-three-way",
			title: "Run the three-way parallel",
			mode: "web-editor",
			estimatedSeconds: 60,
			content: `## Run the three-way parallel

Time to verify your work. Press **▶ Play** and watch three tokens fan out simultaneously.

### What you should see

- Three tokens appear at the split gateway
- All three tasks — Pack, Label, **and Generate invoice** — activate at the same time
- The join waits for all three to complete
- Ship order runs once everything is done

### What you've learned

- ✓ Parallel gateways split execution into concurrent paths
- ✓ The join gateway synchronizes all paths before continuing
- ✓ Any number of tasks can run in parallel
- ✓ Parallel work is modeled structurally — no code required`,
			validation: {
				type: "manual",
				successMessage: "Three tasks in parallel — you've modeled concurrent work like a pro!",
			},
			hints: [
				"Press ▶ Play to run the process",
				"Watch for three tokens appearing at the parallel split gateway",
				"All three tasks should become active at the same time",
			],
		},
	],
}
