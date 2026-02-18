/** Layout positioning for a form component. */
export interface FormLayout {
	row?: string;
	columns?: number | null;
}

/** Validation constraints for a form field. */
export interface FormValidation {
	required?: boolean;
	minLength?: number;
	maxLength?: number;
}

/** A label/value option used by select, radio, and checklist components. */
export interface FormValueOption {
	label: string;
	value: string;
}

/** Base properties shared by all form components. */
interface FormComponentBase {
	id: string;
	type: string;
	layout?: FormLayout;
}

/** Static text/markdown display component. */
export interface FormTextComponent extends FormComponentBase {
	type: "text";
	text: string;
	label?: string;
}

/** Single-line text input. */
export interface FormTextFieldComponent extends FormComponentBase {
	type: "textfield";
	label: string;
	key: string;
	validate?: FormValidation;
	defaultValue?: string;
}

/** Multi-line text input. */
export interface FormTextAreaComponent extends FormComponentBase {
	type: "textarea";
	label: string;
	key: string;
	validate?: FormValidation;
	defaultValue?: string;
}

/** Dropdown select input. */
export interface FormSelectComponent extends FormComponentBase {
	type: "select";
	label: string;
	key: string;
	values?: FormValueOption[];
	valuesKey?: string;
	validate?: FormValidation;
	searchable?: boolean;
	defaultValue?: string;
}

/** Radio button group. */
export interface FormRadioComponent extends FormComponentBase {
	type: "radio";
	label: string;
	key: string;
	values: FormValueOption[];
	validate?: FormValidation;
	defaultValue?: string;
}

/** Single checkbox. */
export interface FormCheckboxComponent extends FormComponentBase {
	type: "checkbox";
	label: string;
	key: string;
	validate?: FormValidation;
	defaultValue?: boolean;
}

/** Multi-select checklist. */
export interface FormChecklistComponent extends FormComponentBase {
	type: "checklist";
	label: string;
	key: string;
	values: FormValueOption[];
	validate?: FormValidation;
}

/** Container that groups nested components. */
export interface FormGroupComponent extends FormComponentBase {
	type: "group";
	label: string;
	components: FormComponent[];
	showOutline?: boolean;
}

/** Discriminated union of all form component types. */
export type FormComponent =
	| FormTextComponent
	| FormTextFieldComponent
	| FormTextAreaComponent
	| FormSelectComponent
	| FormRadioComponent
	| FormCheckboxComponent
	| FormChecklistComponent
	| FormGroupComponent;

/** Exporter metadata. */
export interface FormExporter {
	name: string;
	version: string;
}

/** Root form definition model. */
export interface FormDefinition {
	id: string;
	type: string;
	executionPlatform?: string;
	executionPlatformVersion?: string;
	exporter?: FormExporter;
	schemaVersion?: number;
	components: FormComponent[];
	generated?: boolean;
}
