// What a control sees outside a field, a labelable, a form, a fieldset and a field item: values
// that do nothing and say `isNull`. A platform hands them to a store when its context holds none;
// the field's null value carries the form's.
import { inertPlatform } from "../kernel/index.js";
import type {
	FieldRootView,
	FieldRootState,
	FormView,
	FormErrors,
	FormValidationMode,
	FieldItemView,
	FieldsetView,
	LabelableView,
} from "./form-types.js";
import { DEFAULT_VALIDITY_STATE, type FieldValidityData } from "./form-validity.js";

/** The Field state of a control outside any field. */
export const DEFAULT_FIELD_ROOT_STATE: Readonly<FieldRootState> = /* @__PURE__ */ Object.freeze({
	disabled: false,
	touched: false,
	dirty: false,
	valid: null,
	filled: false,
	focused: false,
});

const noop = () => {};
const EMPTY_SET: ReadonlySet<string> = new Set<string>();

/**
 * The form a field sees outside `Form` (including inside a plain `<form>`): it holds no errors and
 * registers nothing.
 */
export const NULL_FORM: FormView = /* @__PURE__ */ Object.freeze({
	isNull: true,
	errors: /* @__PURE__ */ Object.freeze({}) as FormErrors,
	validationMode: "onSubmit" as FormValidationMode,
	submitCount: 0,
	element: null,
	clearErrors: noop,
	registerField: () => noop,
	getValues: () => ({}),
});

/**
 * The field a control sees outside `Field.Root`: every method does nothing and the state is
 * Field's initial state, so a control reads its own props only.
 */
export const NULL_FIELD: FieldRootView = /* @__PURE__ */ Object.freeze({
	isNull: true,
	scheduler: inertPlatform.scheduler,
	disabled: false,
	name: undefined,
	state: DEFAULT_FIELD_ROOT_STATE,
	invalid: false,
	validityData: /* @__PURE__ */ Object.freeze({
		state: DEFAULT_VALIDITY_STATE,
		error: "",
		errors: [],
		value: "",
		initialValue: null,
	}) as FieldValidityData,
	validationMode: "onSubmit" as FormValidationMode,
	form: NULL_FORM,
	attachControl: () => noop,
	registerInput: () => noop,
	inputControl: () => null,
	submittedInputValues: () => EMPTY_SET,
	setTouched: noop,
	focus: noop,
	blur: noop,
	valueChanged: noop,
	commit: async () => {},
	shouldValidateOnChange: () => false,
	reset: noop,
});

/** The labelable a control sees outside `Field.Root` and `Field.Item`. */
export const NULL_LABELABLE: LabelableView = /* @__PURE__ */ Object.freeze({
	isNull: true,
	controlId: undefined,
	labelId: undefined,
	messageIds: /* @__PURE__ */ Object.freeze([]) as readonly string[],
	registerControlId: noop,
	resetControlId: noop,
	registerLabelId: () => noop,
	addMessageId: () => noop,
	describedBy: (external: string | undefined | null) => external || undefined,
});

/** The fieldset a field sees outside `Fieldset.Root`. */
export const NULL_FIELDSET: FieldsetView = /* @__PURE__ */ Object.freeze({
	isNull: true,
	disabled: false,
});

/** The item a part sees outside Field.Item: never disabled. */
export const NULL_FIELD_ITEM: FieldItemView = /* @__PURE__ */ Object.freeze({
	disabled: false,
});
