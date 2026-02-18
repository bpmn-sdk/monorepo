import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { Dmn, resetIdCounter } from "../src/index.js";

const EXAMPLES_DIR = resolve(import.meta.dirname, "../../..", "examples");

describe("Dmn", () => {
	beforeEach(() => {
		resetIdCounter();
	});

	describe("createDecisionTable builder", () => {
		it("creates a single-input single-output decision table", () => {
			const model = Dmn.createDecisionTable("Decision_1")
				.name("My Decision")
				.input({ label: "Age", expression: "age", typeRef: "number" })
				.output({ label: "Result", name: "result", typeRef: "string" })
				.rule({
					description: "Young",
					inputs: ['"< 18"'],
					outputs: ['"minor"'],
				})
				.rule({
					description: "Adult",
					inputs: ['">=18"'],
					outputs: ['"adult"'],
				})
				.build();

			expect(model.decisions).toHaveLength(1);
			const decision = model.decisions[0];
			expect(decision).toBeDefined();
			expect(decision?.id).toBe("Decision_1");
			expect(decision?.name).toBe("My Decision");

			const table = decision?.decisionTable;
			expect(table.inputs).toHaveLength(1);
			expect(table.outputs).toHaveLength(1);
			expect(table.rules).toHaveLength(2);

			expect(table.inputs[0]?.label).toBe("Age");
			expect(table.inputs[0]?.inputExpression.typeRef).toBe("number");
			expect(table.inputs[0]?.inputExpression.text).toBe("age");

			expect(table.outputs[0]?.name).toBe("result");
			expect(table.outputs[0]?.typeRef).toBe("string");

			expect(table.rules[0]?.description).toBe("Young");
			expect(table.rules[0]?.inputEntries[0]?.text).toBe('"< 18"');
			expect(table.rules[0]?.outputEntries[0]?.text).toBe('"minor"');
		});

		it("creates a multi-output decision table", () => {
			const model = Dmn.createDecisionTable("Decision_multi")
				.name("Multi Output")
				.input({ label: "input1", expression: "x", typeRef: "string" })
				.output({ label: "out1", name: "first", typeRef: "string" })
				.output({ label: "out2", name: "second", typeRef: "number" })
				.rule({
					inputs: ['"a"'],
					outputs: ['"alpha"', "1"],
				})
				.build();

			const table = model.decisions[0]?.decisionTable;
			expect(table.outputs).toHaveLength(2);
			expect(table.outputs[0]?.name).toBe("first");
			expect(table.outputs[1]?.name).toBe("second");
			expect(table.rules[0]?.outputEntries).toHaveLength(2);
		});

		it("supports all hit policies", () => {
			const policies = [
				"UNIQUE",
				"FIRST",
				"ANY",
				"COLLECT",
				"RULE ORDER",
				"OUTPUT ORDER",
				"PRIORITY",
			] as const;

			for (const policy of policies) {
				resetIdCounter();
				const model = Dmn.createDecisionTable("Decision_hp")
					.hitPolicy(policy)
					.input({ expression: "x" })
					.output({ name: "y" })
					.build();

				const table = model.decisions[0]?.decisionTable;
				if (policy === "UNIQUE") {
					expect(table.hitPolicy).toBeUndefined();
				} else {
					expect(table.hitPolicy).toBe(policy);
				}
			}
		});

		it("throws when rule input count mismatches", () => {
			const builder = Dmn.createDecisionTable("Decision_err")
				.input({ expression: "x" })
				.output({ name: "y" });

			expect(() => builder.rule({ inputs: ['"a"', '"b"'], outputs: ['"c"'] })).toThrow(
				"Rule has 2 inputs but table has 1 input columns",
			);
		});

		it("throws when rule output count mismatches", () => {
			const builder = Dmn.createDecisionTable("Decision_err")
				.input({ expression: "x" })
				.output({ name: "y" });

			expect(() => builder.rule({ inputs: ['"a"'], outputs: ['"c"', '"d"'] })).toThrow(
				"Rule has 2 outputs but table has 1 output columns",
			);
		});

		it("exports to XML", () => {
			const xml = Dmn.createDecisionTable("Decision_xml")
				.name("Test")
				.input({ label: "Input", expression: "val", typeRef: "string" })
				.output({ label: "Output", name: "out", typeRef: "string" })
				.rule({ inputs: ['"hello"'], outputs: ['"world"'] })
				.toXml();

			expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
			expect(xml).toContain("<definitions");
			expect(xml).toContain("<decision");
			expect(xml).toContain("<decisionTable");
			expect(xml).toContain("<input");
			expect(xml).toContain("<output");
			expect(xml).toContain("<rule");
		});

		it("generates default diagram with shape", () => {
			const model = Dmn.createDecisionTable("Decision_diag")
				.input({ expression: "x" })
				.output({ name: "y" })
				.build();

			expect(model.diagram).toBeDefined();
			expect(model.diagram?.shapes).toHaveLength(1);
			expect(model.diagram?.shapes[0]?.dmnElementRef).toBe("Decision_diag");
		});
	});

	describe("parse", () => {
		it("parses a simple DMN XML", () => {
			const xml = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="https://www.omg.org/spec/DMN/20191111/MODEL/" id="Def_1" name="DRD" namespace="http://camunda.org/schema/1.0/dmn">
  <decision id="Dec_1" name="Test">
    <decisionTable id="DT_1">
      <input id="In_1" label="input">
        <inputExpression id="IE_1" typeRef="string">
          <text>myVar</text>
        </inputExpression>
      </input>
      <output id="Out_1" label="output" name="result" typeRef="string" />
      <rule id="Rule_1">
        <description>test rule</description>
        <inputEntry id="UT_1">
          <text>"hello"</text>
        </inputEntry>
        <outputEntry id="LE_1">
          <text>"world"</text>
        </outputEntry>
      </rule>
    </decisionTable>
  </decision>
</definitions>`;

			const model = Dmn.parse(xml);

			expect(model.id).toBe("Def_1");
			expect(model.name).toBe("DRD");
			expect(model.decisions).toHaveLength(1);

			const decision = model.decisions[0];
			expect(decision).toBeDefined();
			expect(decision?.id).toBe("Dec_1");
			expect(decision?.name).toBe("Test");

			const table = decision?.decisionTable;
			expect(table.inputs).toHaveLength(1);
			expect(table.inputs[0]?.inputExpression.text).toBe("myVar");
			expect(table.outputs).toHaveLength(1);
			expect(table.outputs[0]?.name).toBe("result");
			expect(table.rules).toHaveLength(1);
			expect(table.rules[0]?.description).toBe("test rule");
		});
	});

	describe("roundtrip", () => {
		it("roundtrips Github>Slack users.dmn", () => {
			const originalXml = readFileSync(resolve(EXAMPLES_DIR, "Github>Slack users.dmn"), "utf-8");

			const model = Dmn.parse(originalXml);
			const exportedXml = Dmn.export(model);
			const reparsed = Dmn.parse(exportedXml);

			// Semantic equivalence checks
			expect(reparsed.id).toBe(model.id);
			expect(reparsed.name).toBe(model.name);
			expect(reparsed.namespace).toBe(model.namespace);
			expect(reparsed.decisions).toHaveLength(model.decisions.length);

			const origDecision = model.decisions[0];
			const rtDecision = reparsed.decisions[0];
			expect(origDecision).toBeDefined();
			expect(rtDecision).toBeDefined();

			expect(rtDecision?.id).toBe(origDecision?.id);
			expect(rtDecision?.name).toBe(origDecision?.name);

			const origTable = origDecision?.decisionTable;
			const rtTable = rtDecision?.decisionTable;

			// 1 input, 2 outputs (multi-output)
			expect(rtTable?.inputs).toHaveLength(origTable?.inputs.length ?? 0);
			expect(rtTable?.outputs).toHaveLength(origTable?.outputs.length ?? 0);
			expect(rtTable?.outputs).toHaveLength(2);

			// All rules preserved
			expect(rtTable?.rules).toHaveLength(origTable?.rules.length ?? 0);

			// Verify each rule's content
			for (let i = 0; i < (origTable?.rules.length ?? 0); i++) {
				const origRule = origTable?.rules[i];
				const rtRule = rtTable?.rules[i];
				expect(rtRule?.id).toBe(origRule?.id);
				expect(rtRule?.description).toBe(origRule?.description);
				expect(rtRule?.inputEntries).toHaveLength(origRule?.inputEntries.length ?? 0);
				expect(rtRule?.outputEntries).toHaveLength(origRule?.outputEntries.length ?? 0);

				for (let j = 0; j < (origRule?.inputEntries.length ?? 0); j++) {
					expect(rtRule?.inputEntries[j]?.text).toBe(origRule?.inputEntries[j]?.text);
				}
				for (let j = 0; j < (origRule?.outputEntries.length ?? 0); j++) {
					expect(rtRule?.outputEntries[j]?.text).toBe(origRule?.outputEntries[j]?.text);
				}
			}

			// Diagram preserved
			expect(rtTable.inputs[0]?.label).toBe(origTable.inputs[0]?.label);
			expect(rtTable.outputs[0]?.label).toBe(origTable.outputs[0]?.label);
			expect(rtTable.outputs[1]?.label).toBe(origTable.outputs[1]?.label);

			expect(reparsed.diagram).toBeDefined();
			expect(reparsed.diagram?.shapes).toHaveLength(model.diagram?.shapes.length);
		});

		it("preserves modeler attributes on roundtrip", () => {
			const originalXml = readFileSync(resolve(EXAMPLES_DIR, "Github>Slack users.dmn"), "utf-8");

			const model = Dmn.parse(originalXml);
			expect(model.modelerAttributes.executionPlatform).toBe("Camunda Cloud");
			expect(model.modelerAttributes.executionPlatformVersion).toBe("8.5.0");
			expect(model.exporter).toBe("Camunda Web Modeler");

			const exportedXml = Dmn.export(model);
			const reparsed = Dmn.parse(exportedXml);

			expect(reparsed.modelerAttributes.executionPlatform).toBe("Camunda Cloud");
			expect(reparsed.modelerAttributes.executionPlatformVersion).toBe("8.5.0");
			expect(reparsed.exporter).toBe("Camunda Web Modeler");
		});
	});
});
