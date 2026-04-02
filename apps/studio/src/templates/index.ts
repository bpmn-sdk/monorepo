export interface ProcessTemplate {
	id: string
	name: string
	description: string
	category: "automation" | "ai" | "data"
	bpmn: string
}

const summarizeDocuments: ProcessTemplate = {
	id: "tpl-summarize-documents",
	name: "Summarize Documents in Folder",
	description:
		"Lists all files in a folder, summarizes each with AI, and writes a combined report.",
	category: "ai",
	bpmn: `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions
  xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
  xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
  xmlns:zeebe="http://camunda.org/schema/zeebe/1.0"
  id="def-summarize-documents"
  targetNamespace="http://bpmnkit.io/templates">
  <bpmn:process id="summarize-documents" name="Summarize Documents in Folder" isExecutable="true">
    <bpmn:startEvent id="sd-start" name="Start">
      <bpmn:outgoing>sd-flow1</bpmn:outgoing>
    </bpmn:startEvent>
    <bpmn:sequenceFlow id="sd-flow1" sourceRef="sd-start" targetRef="sd-list"/>
    <bpmn:serviceTask id="sd-list" name="List Directory">
      <bpmn:extensionElements>
        <zeebe:taskDefinition type="io.bpmnkit:fs:list:1"/>
        <zeebe:taskHeaders>
          <zeebe:header key="resultVariable" value="files"/>
        </zeebe:taskHeaders>
        <zeebe:ioMapping>
          <zeebe:input source="=folderPath" target="path"/>
        </zeebe:ioMapping>
      </bpmn:extensionElements>
      <bpmn:incoming>sd-flow1</bpmn:incoming>
      <bpmn:outgoing>sd-flow2</bpmn:outgoing>
    </bpmn:serviceTask>
    <bpmn:sequenceFlow id="sd-flow2" sourceRef="sd-list" targetRef="sd-foreach"/>
    <bpmn:subProcess id="sd-foreach" name="For Each File">
      <bpmn:multiInstanceLoopCharacteristics isSequential="true">
        <bpmn:extensionElements>
          <zeebe:loopCharacteristics inputCollection="=files" inputElement="file"/>
        </bpmn:extensionElements>
      </bpmn:multiInstanceLoopCharacteristics>
      <bpmn:incoming>sd-flow2</bpmn:incoming>
      <bpmn:outgoing>sd-flow3</bpmn:outgoing>
      <bpmn:startEvent id="sd-sub-start" name="Start">
        <bpmn:outgoing>sd-sub-flow1</bpmn:outgoing>
      </bpmn:startEvent>
      <bpmn:sequenceFlow id="sd-sub-flow1" sourceRef="sd-sub-start" targetRef="sd-read"/>
      <bpmn:serviceTask id="sd-read" name="Read File">
        <bpmn:extensionElements>
          <zeebe:taskDefinition type="io.bpmnkit:fs:read:1"/>
          <zeebe:taskHeaders>
            <zeebe:header key="resultVariable" value="fileContent"/>
          </zeebe:taskHeaders>
          <zeebe:ioMapping>
            <zeebe:input source="=file.path" target="path"/>
          </zeebe:ioMapping>
        </bpmn:extensionElements>
        <bpmn:incoming>sd-sub-flow1</bpmn:incoming>
        <bpmn:outgoing>sd-sub-flow2</bpmn:outgoing>
      </bpmn:serviceTask>
      <bpmn:sequenceFlow id="sd-sub-flow2" sourceRef="sd-read" targetRef="sd-summarize"/>
      <bpmn:serviceTask id="sd-summarize" name="Summarize with AI">
        <bpmn:extensionElements>
          <zeebe:taskDefinition type="io.bpmnkit:llm:1"/>
          <zeebe:taskHeaders>
            <zeebe:header key="resultVariable" value="summary"/>
            <zeebe:header key="systemPrompt" value="Summarize the following document concisely."/>
          </zeebe:taskHeaders>
          <zeebe:ioMapping>
            <zeebe:input source="=fileContent.text" target="prompt"/>
          </zeebe:ioMapping>
        </bpmn:extensionElements>
        <bpmn:incoming>sd-sub-flow2</bpmn:incoming>
        <bpmn:outgoing>sd-sub-flow3</bpmn:outgoing>
      </bpmn:serviceTask>
      <bpmn:sequenceFlow id="sd-sub-flow3" sourceRef="sd-summarize" targetRef="sd-write-summary"/>
      <bpmn:serviceTask id="sd-write-summary" name="Write Summary">
        <bpmn:extensionElements>
          <zeebe:taskDefinition type="io.bpmnkit:fs:write:1"/>
          <zeebe:ioMapping>
            <zeebe:input source="=file.name + &quot;.summary.md&quot;" target="path"/>
            <zeebe:input source="=summary.text" target="content"/>
          </zeebe:ioMapping>
        </bpmn:extensionElements>
        <bpmn:incoming>sd-sub-flow3</bpmn:incoming>
        <bpmn:outgoing>sd-sub-flow4</bpmn:outgoing>
      </bpmn:serviceTask>
      <bpmn:sequenceFlow id="sd-sub-flow4" sourceRef="sd-write-summary" targetRef="sd-sub-end"/>
      <bpmn:endEvent id="sd-sub-end" name="End">
        <bpmn:incoming>sd-sub-flow4</bpmn:incoming>
      </bpmn:endEvent>
    </bpmn:subProcess>
    <bpmn:sequenceFlow id="sd-flow3" sourceRef="sd-foreach" targetRef="sd-report"/>
    <bpmn:serviceTask id="sd-report" name="Write Report">
      <bpmn:extensionElements>
        <zeebe:taskDefinition type="io.bpmnkit:fs:write:1"/>
        <zeebe:ioMapping>
          <zeebe:input source="=reportPath" target="path"/>
          <zeebe:input source="=reportContent" target="content"/>
        </zeebe:ioMapping>
      </bpmn:extensionElements>
      <bpmn:incoming>sd-flow3</bpmn:incoming>
      <bpmn:outgoing>sd-flow4</bpmn:outgoing>
    </bpmn:serviceTask>
    <bpmn:sequenceFlow id="sd-flow4" sourceRef="sd-report" targetRef="sd-end"/>
    <bpmn:endEvent id="sd-end" name="End">
      <bpmn:incoming>sd-flow4</bpmn:incoming>
    </bpmn:endEvent>
  </bpmn:process>
  <bpmndi:BPMNDiagram id="sd-diagram">
    <bpmndi:BPMNPlane id="sd-plane" bpmnElement="summarize-documents">
      <bpmndi:BPMNShape id="sd-start_di" bpmnElement="sd-start">
        <dc:Bounds x="152" y="82" width="36" height="36"/>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="sd-list_di" bpmnElement="sd-list">
        <dc:Bounds x="240" y="60" width="100" height="80"/>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="sd-foreach_di" bpmnElement="sd-foreach" isExpanded="true">
        <dc:Bounds x="390" y="20" width="450" height="200"/>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="sd-sub-start_di" bpmnElement="sd-sub-start">
        <dc:Bounds x="420" y="102" width="36" height="36"/>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="sd-read_di" bpmnElement="sd-read">
        <dc:Bounds x="490" y="80" width="100" height="80"/>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="sd-summarize_di" bpmnElement="sd-summarize">
        <dc:Bounds x="630" y="80" width="100" height="80"/>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="sd-write-summary_di" bpmnElement="sd-write-summary">
        <dc:Bounds x="770" y="80" width="100" height="80"/>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="sd-sub-end_di" bpmnElement="sd-sub-end">
        <dc:Bounds x="910" y="102" width="36" height="36"/>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="sd-report_di" bpmnElement="sd-report">
        <dc:Bounds x="890" y="60" width="100" height="80"/>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="sd-end_di" bpmnElement="sd-end">
        <dc:Bounds x="1040" y="82" width="36" height="36"/>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNEdge id="sd-flow1_di" bpmnElement="sd-flow1">
        <di:waypoint x="188" y="100"/>
        <di:waypoint x="240" y="100"/>
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="sd-flow2_di" bpmnElement="sd-flow2">
        <di:waypoint x="340" y="100"/>
        <di:waypoint x="390" y="100"/>
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="sd-sub-flow1_di" bpmnElement="sd-sub-flow1">
        <di:waypoint x="456" y="120"/>
        <di:waypoint x="490" y="120"/>
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="sd-sub-flow2_di" bpmnElement="sd-sub-flow2">
        <di:waypoint x="590" y="120"/>
        <di:waypoint x="630" y="120"/>
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="sd-sub-flow3_di" bpmnElement="sd-sub-flow3">
        <di:waypoint x="730" y="120"/>
        <di:waypoint x="770" y="120"/>
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="sd-sub-flow4_di" bpmnElement="sd-sub-flow4">
        <di:waypoint x="870" y="120"/>
        <di:waypoint x="910" y="120"/>
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="sd-flow3_di" bpmnElement="sd-flow3">
        <di:waypoint x="840" y="100"/>
        <di:waypoint x="890" y="100"/>
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="sd-flow4_di" bpmnElement="sd-flow4">
        <di:waypoint x="990" y="100"/>
        <di:waypoint x="1040" y="100"/>
      </bpmndi:BPMNEdge>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`,
}

const monitorUrlChanges: ProcessTemplate = {
	id: "tpl-monitor-url-changes",
	name: "Monitor URL for Changes",
	description: "Periodically scrapes a URL and saves the content for change detection.",
	category: "automation",
	bpmn: `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions
  xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
  xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
  xmlns:zeebe="http://camunda.org/schema/zeebe/1.0"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  id="def-monitor-url-changes"
  targetNamespace="http://bpmnkit.io/templates">
  <bpmn:process id="monitor-url-changes" name="Monitor URL for Changes" isExecutable="true">
    <bpmn:startEvent id="muc-start" name="Every Hour">
      <bpmn:outgoing>muc-flow1</bpmn:outgoing>
      <bpmn:timerEventDefinition id="muc-timer">
        <bpmn:timeCycle xsi:type="bpmn:tFormalExpression">R/PT1H</bpmn:timeCycle>
      </bpmn:timerEventDefinition>
    </bpmn:startEvent>
    <bpmn:sequenceFlow id="muc-flow1" sourceRef="muc-start" targetRef="muc-scrape"/>
    <bpmn:serviceTask id="muc-scrape" name="Scrape URL">
      <bpmn:extensionElements>
        <zeebe:taskDefinition type="io.bpmnkit:http:scrape:1"/>
        <zeebe:taskHeaders>
          <zeebe:header key="resultVariable" value="scrapeResult"/>
        </zeebe:taskHeaders>
        <zeebe:ioMapping>
          <zeebe:input source="=targetUrl" target="url"/>
        </zeebe:ioMapping>
      </bpmn:extensionElements>
      <bpmn:incoming>muc-flow1</bpmn:incoming>
      <bpmn:outgoing>muc-flow2</bpmn:outgoing>
    </bpmn:serviceTask>
    <bpmn:sequenceFlow id="muc-flow2" sourceRef="muc-scrape" targetRef="muc-hash"/>
    <bpmn:serviceTask id="muc-hash" name="Compute Hash">
      <bpmn:extensionElements>
        <zeebe:taskDefinition type="io.bpmnkit:js:1"/>
        <zeebe:taskHeaders>
          <zeebe:header key="resultVariable" value="contentHash"/>
          <zeebe:header key="script" value="variables.scrapeResult.text.length.toString()"/>
        </zeebe:taskHeaders>
      </bpmn:extensionElements>
      <bpmn:incoming>muc-flow2</bpmn:incoming>
      <bpmn:outgoing>muc-flow3</bpmn:outgoing>
    </bpmn:serviceTask>
    <bpmn:sequenceFlow id="muc-flow3" sourceRef="muc-hash" targetRef="muc-write"/>
    <bpmn:serviceTask id="muc-write" name="Write Hash File">
      <bpmn:extensionElements>
        <zeebe:taskDefinition type="io.bpmnkit:fs:write:1"/>
        <zeebe:ioMapping>
          <zeebe:input source="=hashFilePath" target="path"/>
          <zeebe:input source="=contentHash" target="content"/>
        </zeebe:ioMapping>
      </bpmn:extensionElements>
      <bpmn:incoming>muc-flow3</bpmn:incoming>
      <bpmn:outgoing>muc-flow4</bpmn:outgoing>
    </bpmn:serviceTask>
    <bpmn:sequenceFlow id="muc-flow4" sourceRef="muc-write" targetRef="muc-end"/>
    <bpmn:endEvent id="muc-end" name="End">
      <bpmn:incoming>muc-flow4</bpmn:incoming>
    </bpmn:endEvent>
  </bpmn:process>
  <bpmndi:BPMNDiagram id="muc-diagram">
    <bpmndi:BPMNPlane id="muc-plane" bpmnElement="monitor-url-changes">
      <bpmndi:BPMNShape id="muc-start_di" bpmnElement="muc-start">
        <dc:Bounds x="152" y="82" width="36" height="36"/>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="muc-scrape_di" bpmnElement="muc-scrape">
        <dc:Bounds x="240" y="60" width="100" height="80"/>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="muc-hash_di" bpmnElement="muc-hash">
        <dc:Bounds x="380" y="60" width="100" height="80"/>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="muc-write_di" bpmnElement="muc-write">
        <dc:Bounds x="520" y="60" width="100" height="80"/>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="muc-end_di" bpmnElement="muc-end">
        <dc:Bounds x="662" y="82" width="36" height="36"/>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNEdge id="muc-flow1_di" bpmnElement="muc-flow1">
        <di:waypoint x="188" y="100"/>
        <di:waypoint x="240" y="100"/>
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="muc-flow2_di" bpmnElement="muc-flow2">
        <di:waypoint x="340" y="100"/>
        <di:waypoint x="380" y="100"/>
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="muc-flow3_di" bpmnElement="muc-flow3">
        <di:waypoint x="480" y="100"/>
        <di:waypoint x="520" y="100"/>
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="muc-flow4_di" bpmnElement="muc-flow4">
        <di:waypoint x="620" y="100"/>
        <di:waypoint x="662" y="100"/>
      </bpmndi:BPMNEdge>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`,
}

const codeReviewAssistant: ProcessTemplate = {
	id: "tpl-code-review-assistant",
	name: "Code Review Assistant",
	description:
		"Reads a source file and uses AI to generate a code review, saved as a Markdown file.",
	category: "ai",
	bpmn: `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions
  xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
  xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
  xmlns:zeebe="http://camunda.org/schema/zeebe/1.0"
  id="def-code-review-assistant"
  targetNamespace="http://bpmnkit.io/templates">
  <bpmn:process id="code-review-assistant" name="Code Review Assistant" isExecutable="true">
    <bpmn:startEvent id="cr-start" name="Start">
      <bpmn:outgoing>cr-flow1</bpmn:outgoing>
    </bpmn:startEvent>
    <bpmn:sequenceFlow id="cr-flow1" sourceRef="cr-start" targetRef="cr-read"/>
    <bpmn:serviceTask id="cr-read" name="Read Source File">
      <bpmn:extensionElements>
        <zeebe:taskDefinition type="io.bpmnkit:fs:read:1"/>
        <zeebe:taskHeaders>
          <zeebe:header key="resultVariable" value="sourceFile"/>
        </zeebe:taskHeaders>
        <zeebe:ioMapping>
          <zeebe:input source="=sourceFilePath" target="path"/>
        </zeebe:ioMapping>
      </bpmn:extensionElements>
      <bpmn:incoming>cr-flow1</bpmn:incoming>
      <bpmn:outgoing>cr-flow2</bpmn:outgoing>
    </bpmn:serviceTask>
    <bpmn:sequenceFlow id="cr-flow2" sourceRef="cr-read" targetRef="cr-review"/>
    <bpmn:serviceTask id="cr-review" name="Review with AI">
      <bpmn:extensionElements>
        <zeebe:taskDefinition type="io.bpmnkit:llm:1"/>
        <zeebe:taskHeaders>
          <zeebe:header key="resultVariable" value="review"/>
          <zeebe:header key="systemPrompt" value="Review the following code. Identify bugs, style issues, and improvements."/>
        </zeebe:taskHeaders>
        <zeebe:ioMapping>
          <zeebe:input source="=sourceFile.text" target="prompt"/>
        </zeebe:ioMapping>
      </bpmn:extensionElements>
      <bpmn:incoming>cr-flow2</bpmn:incoming>
      <bpmn:outgoing>cr-flow3</bpmn:outgoing>
    </bpmn:serviceTask>
    <bpmn:sequenceFlow id="cr-flow3" sourceRef="cr-review" targetRef="cr-write"/>
    <bpmn:serviceTask id="cr-write" name="Write Review">
      <bpmn:extensionElements>
        <zeebe:taskDefinition type="io.bpmnkit:fs:write:1"/>
        <zeebe:ioMapping>
          <zeebe:input source="=reviewOutputPath" target="path"/>
          <zeebe:input source="=review.text" target="content"/>
        </zeebe:ioMapping>
      </bpmn:extensionElements>
      <bpmn:incoming>cr-flow3</bpmn:incoming>
      <bpmn:outgoing>cr-flow4</bpmn:outgoing>
    </bpmn:serviceTask>
    <bpmn:sequenceFlow id="cr-flow4" sourceRef="cr-write" targetRef="cr-end"/>
    <bpmn:endEvent id="cr-end" name="End">
      <bpmn:incoming>cr-flow4</bpmn:incoming>
    </bpmn:endEvent>
  </bpmn:process>
  <bpmndi:BPMNDiagram id="cr-diagram">
    <bpmndi:BPMNPlane id="cr-plane" bpmnElement="code-review-assistant">
      <bpmndi:BPMNShape id="cr-start_di" bpmnElement="cr-start">
        <dc:Bounds x="152" y="82" width="36" height="36"/>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="cr-read_di" bpmnElement="cr-read">
        <dc:Bounds x="240" y="60" width="100" height="80"/>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="cr-review_di" bpmnElement="cr-review">
        <dc:Bounds x="380" y="60" width="100" height="80"/>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="cr-write_di" bpmnElement="cr-write">
        <dc:Bounds x="520" y="60" width="100" height="80"/>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="cr-end_di" bpmnElement="cr-end">
        <dc:Bounds x="662" y="82" width="36" height="36"/>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNEdge id="cr-flow1_di" bpmnElement="cr-flow1">
        <di:waypoint x="188" y="100"/>
        <di:waypoint x="240" y="100"/>
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="cr-flow2_di" bpmnElement="cr-flow2">
        <di:waypoint x="340" y="100"/>
        <di:waypoint x="380" y="100"/>
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="cr-flow3_di" bpmnElement="cr-flow3">
        <di:waypoint x="480" y="100"/>
        <di:waypoint x="520" y="100"/>
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="cr-flow4_di" bpmnElement="cr-flow4">
        <di:waypoint x="620" y="100"/>
        <di:waypoint x="662" y="100"/>
      </bpmndi:BPMNEdge>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`,
}

const batchProcessWithCli: ProcessTemplate = {
	id: "tpl-batch-process-cli",
	name: "Batch Process with CLI",
	description: "Lists files in a directory and runs a shell command for each one in parallel.",
	category: "automation",
	bpmn: `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions
  xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
  xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
  xmlns:zeebe="http://camunda.org/schema/zeebe/1.0"
  id="def-batch-process-cli"
  targetNamespace="http://bpmnkit.io/templates">
  <bpmn:process id="batch-process-cli" name="Batch Process with CLI" isExecutable="true">
    <bpmn:startEvent id="bp-start" name="Start">
      <bpmn:outgoing>bp-flow1</bpmn:outgoing>
    </bpmn:startEvent>
    <bpmn:sequenceFlow id="bp-flow1" sourceRef="bp-start" targetRef="bp-list"/>
    <bpmn:serviceTask id="bp-list" name="List Files">
      <bpmn:extensionElements>
        <zeebe:taskDefinition type="io.bpmnkit:fs:list:1"/>
        <zeebe:taskHeaders>
          <zeebe:header key="resultVariable" value="files"/>
        </zeebe:taskHeaders>
        <zeebe:ioMapping>
          <zeebe:input source="=folderPath" target="path"/>
        </zeebe:ioMapping>
      </bpmn:extensionElements>
      <bpmn:incoming>bp-flow1</bpmn:incoming>
      <bpmn:outgoing>bp-flow2</bpmn:outgoing>
    </bpmn:serviceTask>
    <bpmn:sequenceFlow id="bp-flow2" sourceRef="bp-list" targetRef="bp-foreach"/>
    <bpmn:subProcess id="bp-foreach" name="For Each File">
      <bpmn:multiInstanceLoopCharacteristics isSequential="false">
        <bpmn:extensionElements>
          <zeebe:loopCharacteristics inputCollection="=files" inputElement="file"/>
        </bpmn:extensionElements>
      </bpmn:multiInstanceLoopCharacteristics>
      <bpmn:incoming>bp-flow2</bpmn:incoming>
      <bpmn:outgoing>bp-flow3</bpmn:outgoing>
      <bpmn:startEvent id="bp-sub-start" name="Start">
        <bpmn:outgoing>bp-sub-flow1</bpmn:outgoing>
      </bpmn:startEvent>
      <bpmn:sequenceFlow id="bp-sub-flow1" sourceRef="bp-sub-start" targetRef="bp-cli"/>
      <bpmn:serviceTask id="bp-cli" name="Run CLI Command">
        <bpmn:extensionElements>
          <zeebe:taskDefinition type="io.bpmnkit:cli:1"/>
          <zeebe:taskHeaders>
            <zeebe:header key="resultVariable" value="cliResult"/>
          </zeebe:taskHeaders>
          <zeebe:ioMapping>
            <zeebe:input source="=cliCommand + &quot; &quot; + file.path" target="command"/>
          </zeebe:ioMapping>
        </bpmn:extensionElements>
        <bpmn:incoming>bp-sub-flow1</bpmn:incoming>
        <bpmn:outgoing>bp-sub-flow2</bpmn:outgoing>
      </bpmn:serviceTask>
      <bpmn:sequenceFlow id="bp-sub-flow2" sourceRef="bp-cli" targetRef="bp-sub-end"/>
      <bpmn:endEvent id="bp-sub-end" name="End">
        <bpmn:incoming>bp-sub-flow2</bpmn:incoming>
      </bpmn:endEvent>
    </bpmn:subProcess>
    <bpmn:sequenceFlow id="bp-flow3" sourceRef="bp-foreach" targetRef="bp-end"/>
    <bpmn:endEvent id="bp-end" name="End">
      <bpmn:incoming>bp-flow3</bpmn:incoming>
    </bpmn:endEvent>
  </bpmn:process>
  <bpmndi:BPMNDiagram id="bp-diagram">
    <bpmndi:BPMNPlane id="bp-plane" bpmnElement="batch-process-cli">
      <bpmndi:BPMNShape id="bp-start_di" bpmnElement="bp-start">
        <dc:Bounds x="152" y="82" width="36" height="36"/>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="bp-list_di" bpmnElement="bp-list">
        <dc:Bounds x="240" y="60" width="100" height="80"/>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="bp-foreach_di" bpmnElement="bp-foreach" isExpanded="true">
        <dc:Bounds x="390" y="20" width="350" height="200"/>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="bp-sub-start_di" bpmnElement="bp-sub-start">
        <dc:Bounds x="420" y="102" width="36" height="36"/>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="bp-cli_di" bpmnElement="bp-cli">
        <dc:Bounds x="500" y="80" width="100" height="80"/>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="bp-sub-end_di" bpmnElement="bp-sub-end">
        <dc:Bounds x="654" y="102" width="36" height="36"/>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="bp-end_di" bpmnElement="bp-end">
        <dc:Bounds x="792" y="82" width="36" height="36"/>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNEdge id="bp-flow1_di" bpmnElement="bp-flow1">
        <di:waypoint x="188" y="100"/>
        <di:waypoint x="240" y="100"/>
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="bp-flow2_di" bpmnElement="bp-flow2">
        <di:waypoint x="340" y="100"/>
        <di:waypoint x="390" y="100"/>
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="bp-sub-flow1_di" bpmnElement="bp-sub-flow1">
        <di:waypoint x="456" y="120"/>
        <di:waypoint x="500" y="120"/>
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="bp-sub-flow2_di" bpmnElement="bp-sub-flow2">
        <di:waypoint x="600" y="120"/>
        <di:waypoint x="654" y="120"/>
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="bp-flow3_di" bpmnElement="bp-flow3">
        <di:waypoint x="740" y="100"/>
        <di:waypoint x="792" y="100"/>
      </bpmndi:BPMNEdge>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`,
}

const fetchAndSummarizeWebpage: ProcessTemplate = {
	id: "tpl-fetch-summarize-webpage",
	name: "Fetch and Summarize Webpage",
	description: "Fetches a webpage, extracts its text content, and summarizes it with AI.",
	category: "ai",
	bpmn: `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions
  xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
  xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
  xmlns:zeebe="http://camunda.org/schema/zeebe/1.0"
  id="def-fetch-summarize-webpage"
  targetNamespace="http://bpmnkit.io/templates">
  <bpmn:process id="fetch-summarize-webpage" name="Fetch and Summarize Webpage" isExecutable="true">
    <bpmn:startEvent id="fs-start" name="Start">
      <bpmn:outgoing>fs-flow1</bpmn:outgoing>
    </bpmn:startEvent>
    <bpmn:sequenceFlow id="fs-flow1" sourceRef="fs-start" targetRef="fs-scrape"/>
    <bpmn:serviceTask id="fs-scrape" name="Scrape URL">
      <bpmn:extensionElements>
        <zeebe:taskDefinition type="io.bpmnkit:http:scrape:1"/>
        <zeebe:taskHeaders>
          <zeebe:header key="resultVariable" value="pageContent"/>
        </zeebe:taskHeaders>
        <zeebe:ioMapping>
          <zeebe:input source="=pageUrl" target="url"/>
        </zeebe:ioMapping>
      </bpmn:extensionElements>
      <bpmn:incoming>fs-flow1</bpmn:incoming>
      <bpmn:outgoing>fs-flow2</bpmn:outgoing>
    </bpmn:serviceTask>
    <bpmn:sequenceFlow id="fs-flow2" sourceRef="fs-scrape" targetRef="fs-summarize"/>
    <bpmn:serviceTask id="fs-summarize" name="Summarize with AI">
      <bpmn:extensionElements>
        <zeebe:taskDefinition type="io.bpmnkit:llm:1"/>
        <zeebe:taskHeaders>
          <zeebe:header key="resultVariable" value="summary"/>
          <zeebe:header key="systemPrompt" value="Summarize the following webpage content concisely."/>
        </zeebe:taskHeaders>
        <zeebe:ioMapping>
          <zeebe:input source="=pageContent.text" target="prompt"/>
        </zeebe:ioMapping>
      </bpmn:extensionElements>
      <bpmn:incoming>fs-flow2</bpmn:incoming>
      <bpmn:outgoing>fs-flow3</bpmn:outgoing>
    </bpmn:serviceTask>
    <bpmn:sequenceFlow id="fs-flow3" sourceRef="fs-summarize" targetRef="fs-write"/>
    <bpmn:serviceTask id="fs-write" name="Write Summary File">
      <bpmn:extensionElements>
        <zeebe:taskDefinition type="io.bpmnkit:fs:write:1"/>
        <zeebe:ioMapping>
          <zeebe:input source="=outputPath" target="path"/>
          <zeebe:input source="=summary.text" target="content"/>
        </zeebe:ioMapping>
      </bpmn:extensionElements>
      <bpmn:incoming>fs-flow3</bpmn:incoming>
      <bpmn:outgoing>fs-flow4</bpmn:outgoing>
    </bpmn:serviceTask>
    <bpmn:sequenceFlow id="fs-flow4" sourceRef="fs-write" targetRef="fs-end"/>
    <bpmn:endEvent id="fs-end" name="End">
      <bpmn:incoming>fs-flow4</bpmn:incoming>
    </bpmn:endEvent>
  </bpmn:process>
  <bpmndi:BPMNDiagram id="fs-diagram">
    <bpmndi:BPMNPlane id="fs-plane" bpmnElement="fetch-summarize-webpage">
      <bpmndi:BPMNShape id="fs-start_di" bpmnElement="fs-start">
        <dc:Bounds x="152" y="82" width="36" height="36"/>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="fs-scrape_di" bpmnElement="fs-scrape">
        <dc:Bounds x="240" y="60" width="100" height="80"/>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="fs-summarize_di" bpmnElement="fs-summarize">
        <dc:Bounds x="380" y="60" width="100" height="80"/>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="fs-write_di" bpmnElement="fs-write">
        <dc:Bounds x="520" y="60" width="100" height="80"/>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="fs-end_di" bpmnElement="fs-end">
        <dc:Bounds x="662" y="82" width="36" height="36"/>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNEdge id="fs-flow1_di" bpmnElement="fs-flow1">
        <di:waypoint x="188" y="100"/>
        <di:waypoint x="240" y="100"/>
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="fs-flow2_di" bpmnElement="fs-flow2">
        <di:waypoint x="340" y="100"/>
        <di:waypoint x="380" y="100"/>
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="fs-flow3_di" bpmnElement="fs-flow3">
        <di:waypoint x="480" y="100"/>
        <di:waypoint x="520" y="100"/>
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="fs-flow4_di" bpmnElement="fs-flow4">
        <di:waypoint x="620" y="100"/>
        <di:waypoint x="662" y="100"/>
      </bpmndi:BPMNEdge>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`,
}

export const PROCESS_TEMPLATES: ProcessTemplate[] = [
	summarizeDocuments,
	monitorUrlChanges,
	codeReviewAssistant,
	batchProcessWithCli,
	fetchAndSummarizeWebpage,
]
