export const examples: Record<string, string> = {
	simple: `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" xmlns:di="http://www.omg.org/spec/DD/20100524/DI" xmlns:zeebe="http://camunda.org/schema/zeebe/1.0" xmlns:modeler="http://camunda.org/schema/modeler/1.0" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" id="Definitions_1" targetNamespace="http://bpmn.io/schema/bpmn" exporter="@urbanisierung/bpmn-sdk" exporterVersion="0.0.1" modeler:executionPlatform="Camunda Cloud" modeler:executionPlatformVersion="8.6.0">
  <bpmn:process id="order-validation" name="Order Validation" isExecutable="true">
    <bpmn:startEvent id="start" name="Order Received">
      <bpmn:outgoing>Flow_0000001</bpmn:outgoing>
    </bpmn:startEvent>
    <bpmn:serviceTask id="validate" name="Validate Order">
      <bpmn:extensionElements>
        <zeebe:taskDefinition type="validate-order"/>
      </bpmn:extensionElements>
      <bpmn:incoming>Flow_0000001</bpmn:incoming>
      <bpmn:outgoing>Flow_0000002</bpmn:outgoing>
    </bpmn:serviceTask>
    <bpmn:serviceTask id="notify" name="Send Confirmation">
      <bpmn:extensionElements>
        <zeebe:taskDefinition type="send-email"/>
      </bpmn:extensionElements>
      <bpmn:incoming>Flow_0000002</bpmn:incoming>
      <bpmn:outgoing>Flow_0000003</bpmn:outgoing>
    </bpmn:serviceTask>
    <bpmn:endEvent id="end" name="Done">
      <bpmn:incoming>Flow_0000003</bpmn:incoming>
    </bpmn:endEvent>
    <bpmn:sequenceFlow id="Flow_0000001" sourceRef="start" targetRef="validate"/>
    <bpmn:sequenceFlow id="Flow_0000002" sourceRef="validate" targetRef="notify"/>
    <bpmn:sequenceFlow id="Flow_0000003" sourceRef="notify" targetRef="end"/>
  </bpmn:process>
  <bpmndi:BPMNDiagram id="order-validation_di">
    <bpmndi:BPMNPlane id="order-validation_di_plane" bpmnElement="order-validation">
      <bpmndi:BPMNShape id="start_di" bpmnElement="start">
        <dc:Bounds x="82" y="84" width="36" height="36"/>
        <bpmndi:BPMNLabel>
          <dc:Bounds x="51" y="124" width="98" height="14"/>
        </bpmndi:BPMNLabel>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="validate_di" bpmnElement="validate">
        <dc:Bounds x="250" y="62" width="100" height="80"/>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="notify_di" bpmnElement="notify">
        <dc:Bounds x="450" y="62" width="100" height="80"/>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="end_di" bpmnElement="end">
        <dc:Bounds x="682" y="84" width="36" height="36"/>
        <bpmndi:BPMNLabel>
          <dc:Bounds x="680" y="124" width="40" height="14"/>
        </bpmndi:BPMNLabel>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNEdge id="Flow_0000001_di" bpmnElement="Flow_0000001">
        <di:waypoint x="118" y="102"/>
        <di:waypoint x="250" y="102"/>
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_0000002_di" bpmnElement="Flow_0000002">
        <di:waypoint x="350" y="102"/>
        <di:waypoint x="450" y="102"/>
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_0000003_di" bpmnElement="Flow_0000003">
        <di:waypoint x="550" y="102"/>
        <di:waypoint x="682" y="102"/>
      </bpmndi:BPMNEdge>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`,

	gateway: `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" xmlns:di="http://www.omg.org/spec/DD/20100524/DI" xmlns:zeebe="http://camunda.org/schema/zeebe/1.0" xmlns:modeler="http://camunda.org/schema/modeler/1.0" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" id="Definitions_1" targetNamespace="http://bpmn.io/schema/bpmn" exporter="@urbanisierung/bpmn-sdk" exporterVersion="0.0.1" modeler:executionPlatform="Camunda Cloud" modeler:executionPlatformVersion="8.6.0">
  <bpmn:process id="approval-flow" name="Approval Workflow" isExecutable="true">
    <bpmn:startEvent id="start" name="Request Submitted">
      <bpmn:outgoing>Flow_0000004</bpmn:outgoing>
    </bpmn:startEvent>
    <bpmn:serviceTask id="review" name="Auto Review">
      <bpmn:extensionElements>
        <zeebe:taskDefinition type="auto-review"/>
      </bpmn:extensionElements>
      <bpmn:incoming>Flow_0000004</bpmn:incoming>
      <bpmn:outgoing>Flow_0000005</bpmn:outgoing>
    </bpmn:serviceTask>
    <bpmn:exclusiveGateway id="decision" name="Approved?" default="Flow_0000008">
      <bpmn:incoming>Flow_0000005</bpmn:incoming>
      <bpmn:outgoing>Flow_0000006</bpmn:outgoing>
      <bpmn:outgoing>Flow_0000008</bpmn:outgoing>
    </bpmn:exclusiveGateway>
    <bpmn:serviceTask id="process" name="Process Request">
      <bpmn:extensionElements>
        <zeebe:taskDefinition type="process"/>
      </bpmn:extensionElements>
      <bpmn:incoming>Flow_0000006</bpmn:incoming>
      <bpmn:outgoing>Flow_0000007</bpmn:outgoing>
    </bpmn:serviceTask>
    <bpmn:endEvent id="done" name="Completed">
      <bpmn:incoming>Flow_0000007</bpmn:incoming>
    </bpmn:endEvent>
    <bpmn:serviceTask id="reject" name="Send Rejection">
      <bpmn:extensionElements>
        <zeebe:taskDefinition type="reject"/>
      </bpmn:extensionElements>
      <bpmn:incoming>Flow_0000008</bpmn:incoming>
      <bpmn:outgoing>Flow_0000009</bpmn:outgoing>
    </bpmn:serviceTask>
    <bpmn:endEvent id="rejected" name="Rejected">
      <bpmn:incoming>Flow_0000009</bpmn:incoming>
    </bpmn:endEvent>
    <bpmn:sequenceFlow id="Flow_0000004" sourceRef="start" targetRef="review"/>
    <bpmn:sequenceFlow id="Flow_0000005" sourceRef="review" targetRef="decision"/>
    <bpmn:sequenceFlow id="Flow_0000006" sourceRef="decision" targetRef="process" name="approved">
      <bpmn:conditionExpression xsi:type="bpmn:tFormalExpression">= approved = true</bpmn:conditionExpression>
    </bpmn:sequenceFlow>
    <bpmn:sequenceFlow id="Flow_0000007" sourceRef="process" targetRef="done"/>
    <bpmn:sequenceFlow id="Flow_0000008" sourceRef="decision" targetRef="reject" name="rejected"/>
    <bpmn:sequenceFlow id="Flow_0000009" sourceRef="reject" targetRef="rejected"/>
  </bpmn:process>
  <bpmndi:BPMNDiagram id="approval-flow_di">
    <bpmndi:BPMNPlane id="approval-flow_di_plane" bpmnElement="approval-flow">
      <bpmndi:BPMNShape id="start_di" bpmnElement="start">
        <dc:Bounds x="82" y="164" width="36" height="36"/>
        <bpmndi:BPMNLabel>
          <dc:Bounds x="40.5" y="204" width="119" height="14"/>
        </bpmndi:BPMNLabel>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="review_di" bpmnElement="review">
        <dc:Bounds x="250" y="142" width="100" height="80"/>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="decision_di" bpmnElement="decision">
        <dc:Bounds x="482" y="164" width="36" height="36"/>
        <bpmndi:BPMNLabel>
          <dc:Bounds x="522" y="146" width="63" height="14"/>
        </bpmndi:BPMNLabel>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="process_di" bpmnElement="process">
        <dc:Bounds x="650" y="62" width="100" height="80"/>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="reject_di" bpmnElement="reject">
        <dc:Bounds x="650" y="222" width="100" height="80"/>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="done_di" bpmnElement="done">
        <dc:Bounds x="882" y="84" width="36" height="36"/>
        <bpmndi:BPMNLabel>
          <dc:Bounds x="868.5" y="124" width="63" height="14"/>
        </bpmndi:BPMNLabel>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="rejected_di" bpmnElement="rejected">
        <dc:Bounds x="882" y="244" width="36" height="36"/>
        <bpmndi:BPMNLabel>
          <dc:Bounds x="872" y="284" width="56" height="14"/>
        </bpmndi:BPMNLabel>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNEdge id="Flow_0000004_di" bpmnElement="Flow_0000004">
        <di:waypoint x="118" y="182"/>
        <di:waypoint x="250" y="182"/>
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_0000005_di" bpmnElement="Flow_0000005">
        <di:waypoint x="350" y="182"/>
        <di:waypoint x="482" y="182"/>
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_0000006_di" bpmnElement="Flow_0000006">
        <di:waypoint x="500" y="164"/>
        <di:waypoint x="500" y="102"/>
        <di:waypoint x="650" y="102"/>
        <bpmndi:BPMNLabel>
          <dc:Bounds x="547" y="78" width="56" height="14"/>
        </bpmndi:BPMNLabel>
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_0000007_di" bpmnElement="Flow_0000007">
        <di:waypoint x="750" y="102"/>
        <di:waypoint x="882" y="102"/>
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_0000008_di" bpmnElement="Flow_0000008">
        <di:waypoint x="500" y="200"/>
        <di:waypoint x="500" y="262"/>
        <di:waypoint x="650" y="262"/>
        <bpmndi:BPMNLabel>
          <dc:Bounds x="547" y="238" width="56" height="14"/>
        </bpmndi:BPMNLabel>
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_0000009_di" bpmnElement="Flow_0000009">
        <di:waypoint x="750" y="262"/>
        <di:waypoint x="882" y="262"/>
      </bpmndi:BPMNEdge>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`,

	parallel: `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" xmlns:di="http://www.omg.org/spec/DD/20100524/DI" xmlns:zeebe="http://camunda.org/schema/zeebe/1.0" xmlns:modeler="http://camunda.org/schema/modeler/1.0" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" id="Definitions_1" targetNamespace="http://bpmn.io/schema/bpmn" exporter="@urbanisierung/bpmn-sdk" exporterVersion="0.0.1" modeler:executionPlatform="Camunda Cloud" modeler:executionPlatformVersion="8.6.0">
  <bpmn:process id="order-fulfillment" name="Order Fulfillment" isExecutable="true">
    <bpmn:startEvent id="start" name="Order Placed">
      <bpmn:outgoing>Flow_0000001</bpmn:outgoing>
    </bpmn:startEvent>
    <bpmn:parallelGateway id="fork">
      <bpmn:incoming>Flow_0000001</bpmn:incoming>
      <bpmn:outgoing>Flow_0000002</bpmn:outgoing>
      <bpmn:outgoing>Flow_0000003</bpmn:outgoing>
      <bpmn:outgoing>Flow_0000004</bpmn:outgoing>
    </bpmn:parallelGateway>
    <bpmn:serviceTask id="pay" name="Process Payment">
      <bpmn:extensionElements>
        <zeebe:taskDefinition type="payment-service"/>
      </bpmn:extensionElements>
      <bpmn:incoming>Flow_0000002</bpmn:incoming>
    </bpmn:serviceTask>
    <bpmn:serviceTask id="stock" name="Reserve Inventory">
      <bpmn:extensionElements>
        <zeebe:taskDefinition type="inventory-service"/>
      </bpmn:extensionElements>
      <bpmn:incoming>Flow_0000003</bpmn:incoming>
    </bpmn:serviceTask>
    <bpmn:serviceTask id="email" name="Send Confirmation">
      <bpmn:extensionElements>
        <zeebe:taskDefinition type="email-service"/>
      </bpmn:extensionElements>
      <bpmn:incoming>Flow_0000004</bpmn:incoming>
    </bpmn:serviceTask>
    <bpmn:serviceTask id="ship" name="Ship Order">
      <bpmn:extensionElements>
        <zeebe:taskDefinition type="shipping-service"/>
      </bpmn:extensionElements>
      <bpmn:outgoing>Flow_0000005</bpmn:outgoing>
    </bpmn:serviceTask>
    <bpmn:endEvent id="end" name="Order Complete">
      <bpmn:incoming>Flow_0000005</bpmn:incoming>
    </bpmn:endEvent>
    <bpmn:sequenceFlow id="Flow_0000001" sourceRef="start" targetRef="fork"/>
    <bpmn:sequenceFlow id="Flow_0000002" sourceRef="fork" targetRef="pay" name="payment"/>
    <bpmn:sequenceFlow id="Flow_0000003" sourceRef="fork" targetRef="stock" name="inventory"/>
    <bpmn:sequenceFlow id="Flow_0000004" sourceRef="fork" targetRef="email" name="notifications"/>
    <bpmn:sequenceFlow id="Flow_0000005" sourceRef="ship" targetRef="end"/>
  </bpmn:process>
  <bpmndi:BPMNDiagram id="order-fulfillment_di">
    <bpmndi:BPMNPlane id="order-fulfillment_di_plane" bpmnElement="order-fulfillment">
      <bpmndi:BPMNShape id="start_di" bpmnElement="start">
        <dc:Bounds x="82" y="182" width="36" height="36"/>
        <bpmndi:BPMNLabel>
          <dc:Bounds x="58" y="222" width="84" height="14"/>
        </bpmndi:BPMNLabel>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="ship_di" bpmnElement="ship">
        <dc:Bounds x="50" y="320" width="100" height="80"/>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="fork_di" bpmnElement="fork">
        <dc:Bounds x="282" y="182" width="36" height="36"/>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="end_di" bpmnElement="end">
        <dc:Bounds x="282" y="342" width="36" height="36"/>
        <bpmndi:BPMNLabel>
          <dc:Bounds x="251" y="382" width="98" height="14"/>
        </bpmndi:BPMNLabel>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="pay_di" bpmnElement="pay">
        <dc:Bounds x="450" y="0" width="100" height="80"/>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="stock_di" bpmnElement="stock">
        <dc:Bounds x="450" y="160" width="100" height="80"/>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="email_di" bpmnElement="email">
        <dc:Bounds x="450" y="320" width="100" height="80"/>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNEdge id="Flow_0000001_di" bpmnElement="Flow_0000001">
        <di:waypoint x="118" y="200"/>
        <di:waypoint x="282" y="200"/>
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_0000002_di" bpmnElement="Flow_0000002">
        <di:waypoint x="300" y="182"/>
        <di:waypoint x="300" y="40"/>
        <di:waypoint x="450" y="40"/>
        <bpmndi:BPMNLabel>
          <dc:Bounds x="350.5" y="16" width="49" height="14"/>
        </bpmndi:BPMNLabel>
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_0000003_di" bpmnElement="Flow_0000003">
        <di:waypoint x="318" y="200"/>
        <di:waypoint x="450" y="200"/>
        <bpmndi:BPMNLabel>
          <dc:Bounds x="352.5" y="176" width="63" height="14"/>
        </bpmndi:BPMNLabel>
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_0000004_di" bpmnElement="Flow_0000004">
        <di:waypoint x="300" y="218"/>
        <di:waypoint x="300" y="360"/>
        <di:waypoint x="450" y="360"/>
        <bpmndi:BPMNLabel>
          <dc:Bounds x="329.5" y="336" width="91" height="14"/>
        </bpmndi:BPMNLabel>
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_0000005_di" bpmnElement="Flow_0000005">
        <di:waypoint x="150" y="360"/>
        <di:waypoint x="282" y="360"/>
      </bpmndi:BPMNEdge>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`,

	"ai-agent": `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" xmlns:di="http://www.omg.org/spec/DD/20100524/DI" xmlns:zeebe="http://camunda.org/schema/zeebe/1.0" xmlns:modeler="http://camunda.org/schema/modeler/1.0" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" id="Definitions_1" targetNamespace="http://bpmn.io/schema/bpmn" exporter="@urbanisierung/bpmn-sdk" exporterVersion="0.0.1" modeler:executionPlatform="Camunda Cloud" modeler:executionPlatformVersion="8.6.0">
  <bpmn:process id="ai-support-agent" name="AI Support Agent" isExecutable="true">
    <bpmn:startEvent id="start" name="Ticket Created">
      <bpmn:outgoing>Flow_0000001</bpmn:outgoing>
    </bpmn:startEvent>
    <bpmn:serviceTask id="enrich" name="Fetch Context">
      <bpmn:extensionElements>
        <zeebe:taskDefinition type="fetch-customer-data"/>
      </bpmn:extensionElements>
      <bpmn:incoming>Flow_0000001</bpmn:incoming>
      <bpmn:outgoing>Flow_0000003</bpmn:outgoing>
    </bpmn:serviceTask>
    <bpmn:adHocSubProcess id="agent" name="AI Agent">
      <bpmn:extensionElements>
        <zeebe:taskDefinition type="io.camunda:ai-agent:1"/>
      </bpmn:extensionElements>
      <bpmn:incoming>Flow_0000003</bpmn:incoming>
      <bpmn:outgoing>Flow_0000004</bpmn:outgoing>
      <bpmn:serviceTask id="search" name="Search KB">
        <bpmn:extensionElements>
          <zeebe:taskDefinition type="knowledge-search"/>
        </bpmn:extensionElements>
        <bpmn:outgoing>Flow_0000002</bpmn:outgoing>
      </bpmn:serviceTask>
      <bpmn:serviceTask id="draft" name="Draft Response">
        <bpmn:extensionElements>
          <zeebe:taskDefinition type="draft-reply"/>
        </bpmn:extensionElements>
        <bpmn:incoming>Flow_0000002</bpmn:incoming>
      </bpmn:serviceTask>
      <bpmn:sequenceFlow id="Flow_0000002" sourceRef="search" targetRef="draft"/>
    </bpmn:adHocSubProcess>
    <bpmn:exclusiveGateway id="check" name="Confidence?" default="Flow_0000007">
      <bpmn:incoming>Flow_0000004</bpmn:incoming>
      <bpmn:outgoing>Flow_0000005</bpmn:outgoing>
      <bpmn:outgoing>Flow_0000007</bpmn:outgoing>
    </bpmn:exclusiveGateway>
    <bpmn:serviceTask id="send" name="Auto-Reply">
      <bpmn:extensionElements>
        <zeebe:taskDefinition type="send-reply"/>
      </bpmn:extensionElements>
      <bpmn:incoming>Flow_0000005</bpmn:incoming>
      <bpmn:outgoing>Flow_0000006</bpmn:outgoing>
    </bpmn:serviceTask>
    <bpmn:endEvent id="resolved" name="Resolved">
      <bpmn:incoming>Flow_0000006</bpmn:incoming>
    </bpmn:endEvent>
    <bpmn:userTask id="escalate" name="Human Review">
      <bpmn:extensionElements>
        <zeebe:formDefinition formId="review-form"/>
      </bpmn:extensionElements>
      <bpmn:incoming>Flow_0000007</bpmn:incoming>
      <bpmn:outgoing>Flow_0000008</bpmn:outgoing>
    </bpmn:userTask>
    <bpmn:endEvent id="escalated" name="Escalated">
      <bpmn:incoming>Flow_0000008</bpmn:incoming>
    </bpmn:endEvent>
    <bpmn:sequenceFlow id="Flow_0000001" sourceRef="start" targetRef="enrich"/>
    <bpmn:sequenceFlow id="Flow_0000003" sourceRef="enrich" targetRef="agent"/>
    <bpmn:sequenceFlow id="Flow_0000004" sourceRef="agent" targetRef="check"/>
    <bpmn:sequenceFlow id="Flow_0000005" sourceRef="check" targetRef="send" name="high">
      <bpmn:conditionExpression xsi:type="bpmn:tFormalExpression">= confidence > 0.9</bpmn:conditionExpression>
    </bpmn:sequenceFlow>
    <bpmn:sequenceFlow id="Flow_0000006" sourceRef="send" targetRef="resolved"/>
    <bpmn:sequenceFlow id="Flow_0000007" sourceRef="check" targetRef="escalate" name="low"/>
    <bpmn:sequenceFlow id="Flow_0000008" sourceRef="escalate" targetRef="escalated"/>
  </bpmn:process>
  <bpmndi:BPMNDiagram id="ai-support-agent_di">
    <bpmndi:BPMNPlane id="ai-support-agent_di_plane" bpmnElement="ai-support-agent">
      <bpmndi:BPMNShape id="start_di" bpmnElement="start">
        <dc:Bounds x="82" y="164" width="36" height="36"/>
        <bpmndi:BPMNLabel>
          <dc:Bounds x="51" y="204" width="98" height="14"/>
        </bpmndi:BPMNLabel>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="enrich_di" bpmnElement="enrich">
        <dc:Bounds x="250" y="142" width="100" height="80"/>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="agent_di" bpmnElement="agent" isExpanded="true">
        <dc:Bounds x="450" y="122" width="340" height="120"/>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="check_di" bpmnElement="check">
        <dc:Bounds x="840" y="164" width="36" height="36"/>
        <bpmndi:BPMNLabel>
          <dc:Bounds x="880" y="146" width="77" height="14"/>
        </bpmndi:BPMNLabel>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="send_di" bpmnElement="send">
        <dc:Bounds x="1007" y="62" width="100" height="80"/>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="escalate_di" bpmnElement="escalate">
        <dc:Bounds x="1007" y="222" width="100" height="80"/>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="resolved_di" bpmnElement="resolved">
        <dc:Bounds x="1157" y="84" width="36" height="36"/>
        <bpmndi:BPMNLabel>
          <dc:Bounds x="1147" y="124" width="56" height="14"/>
        </bpmndi:BPMNLabel>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="escalated_di" bpmnElement="escalated">
        <dc:Bounds x="1157" y="244" width="36" height="36"/>
        <bpmndi:BPMNLabel>
          <dc:Bounds x="1143.5" y="284" width="63" height="14"/>
        </bpmndi:BPMNLabel>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="search_di" bpmnElement="search">
        <dc:Bounds x="470" y="142" width="100" height="80"/>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="draft_di" bpmnElement="draft">
        <dc:Bounds x="670" y="142" width="100" height="80"/>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNEdge id="Flow_0000001_di" bpmnElement="Flow_0000001">
        <di:waypoint x="118" y="182"/>
        <di:waypoint x="250" y="182"/>
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_0000003_di" bpmnElement="Flow_0000003">
        <di:waypoint x="350" y="182"/>
        <di:waypoint x="450" y="182"/>
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_0000004_di" bpmnElement="Flow_0000004">
        <di:waypoint x="790" y="182"/>
        <di:waypoint x="840" y="182"/>
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_0000005_di" bpmnElement="Flow_0000005">
        <di:waypoint x="858" y="164"/>
        <di:waypoint x="858" y="102"/>
        <di:waypoint x="1007" y="102"/>
        <bpmndi:BPMNLabel>
          <dc:Bounds x="912.5" y="78" width="40" height="14"/>
        </bpmndi:BPMNLabel>
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_0000006_di" bpmnElement="Flow_0000006">
        <di:waypoint x="1107" y="102"/>
        <di:waypoint x="1157" y="102"/>
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_0000007_di" bpmnElement="Flow_0000007">
        <di:waypoint x="858" y="200"/>
        <di:waypoint x="858" y="262"/>
        <di:waypoint x="1007" y="262"/>
        <bpmndi:BPMNLabel>
          <dc:Bounds x="912.5" y="238" width="40" height="14"/>
        </bpmndi:BPMNLabel>
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_0000008_di" bpmnElement="Flow_0000008">
        <di:waypoint x="1107" y="262"/>
        <di:waypoint x="1157" y="262"/>
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_0000002_di" bpmnElement="Flow_0000002">
        <di:waypoint x="570" y="182"/>
        <di:waypoint x="670" y="182"/>
      </bpmndi:BPMNEdge>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`,
};
