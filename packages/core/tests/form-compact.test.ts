import { describe, expect, it } from "vitest"
import { Form, compactifyForm, expandForm } from "../src/index.js"

describe("Form.makeEmpty", () => {
	it("returns a valid FormDefinition", () => {
		const form = Form.makeEmpty()
		expect(form.type).toBe("default")
		expect(form.components).toHaveLength(1)
		expect(form.components[0]?.type).toBe("button")
	})

	it("accepts a custom id", () => {
		const form = Form.makeEmpty("MyForm_1")
		expect(form.id).toBe("MyForm_1")
	})
})

describe("compactifyForm / expandForm", () => {
	it("compactifies a form definition", () => {
		const form = Form.create("Form_1")
			.textfield("Name", "name", { validate: { required: true } })
			.select("Status", "status", { values: [{ label: "Active", value: "active" }] })
			.build()

		const compact = compactifyForm(form)
		expect(compact.id).toBe("Form_1")
		expect(compact.fields).toHaveLength(2)
		expect(compact.fields[0]?.type).toBe("textfield")
		expect(compact.fields[0]?.label).toBe("Name")
		expect(compact.fields[0]?.key).toBe("name")
		expect(compact.fields[0]?.required).toBe(true)
		expect(compact.fields[1]?.values).toHaveLength(1)
	})

	it("round-trips a form definition", () => {
		const compact = {
			id: "Form_1",
			fields: [
				{ type: "textfield", id: "f1", label: "First Name", key: "firstName", required: true },
				{
					type: "select",
					id: "f2",
					label: "Department",
					key: "dept",
					values: [{ label: "Engineering", value: "eng" }],
				},
				{ type: "button", id: "btn1", label: "Submit" },
			],
		}

		const result = expandForm(compact)
		expect(result.id).toBe("Form_1")
		expect(result.type).toBe("default")
		expect(result.components).toHaveLength(3)

		const textfield = result.components[0]
		if (!textfield || textfield.type !== "textfield") throw new Error("Expected textfield")
		expect(textfield.label).toBe("First Name")
		expect(textfield.key).toBe("firstName")
		expect(textfield.validate?.required).toBe(true)

		const select = result.components[1]
		if (!select || select.type !== "select") throw new Error("Expected select")
		expect(select.values).toHaveLength(1)
	})

	it("handles group components with nested fields", () => {
		const compact = {
			id: "Form_1",
			fields: [
				{
					type: "group",
					id: "g1",
					label: "Personal Info",
					fields: [{ type: "textfield", id: "f1", label: "Name", key: "name" }],
				},
			],
		}

		const result = expandForm(compact)
		const group = result.components[0]
		if (!group || group.type !== "group") throw new Error("Expected group")
		expect(group.label).toBe("Personal Info")
		expect(group.components).toHaveLength(1)
		expect(group.components[0]?.type).toBe("textfield")
	})

	it("Form.compactify and Form.expand are on the namespace", () => {
		const form = Form.makeEmpty()
		const compact = Form.compactify(form)
		const result = Form.expand(compact)
		expect(result.type).toBe("default")
	})
})
