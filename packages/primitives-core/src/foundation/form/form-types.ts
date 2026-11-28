// What fields, fieldsets, forms and labelable scopes share with the controls in them, as types.
// Each platform defines the contexts that carry these values; their null values are in
// `form-null.ts`.
import type { PlatformTypes, Scheduler } from "../kernel/index.js";
import type { FieldValidityData } from "./form-validity.js";

/** The Field state every field part and field-aware control adds to its own state. */
export interface FieldRootState {
	/** Whether the component should ignore user interaction. */
	disabled: boolean;
	/** Whether the field has been touched. */
	touched: boolean;
	/** Whether the field value has changed from its initial value. */
	dirty: boolean;
	/** Whether the field is valid. `null` until it has been validated. */
	valid: boolean | null;
	/** Whether the field has a value. */
	filled: boolean;
	/** Whether the field's control is focused. */
	focused: boolean;
}

/** A control as its field sees it. Getters are live; the platform layer sets `element`. */
export interface FieldControlRegistration<T extends PlatformTypes = PlatformTypes> {
	/** The value the field validates and compares with its baseline. */
	readonly value: unknown;
	/** The control's own name, used when Field.Root has none. */
	readonly name: string | undefined;
	/** Whether the control has a value. */
	readonly filled: boolean;
	/** Whether the control is disabled: a disabled control takes no part in validation. */
	readonly disabled: boolean;
	/** The element a form focuses when the field is its first invalid one. */
	readonly element: T["element"] | null;
	/**
	 * The value a form submits for the field, when it differs from `value` (a checkbox group
	 * submits only the values of its checkboxes the form would include).
	 */
	readonly getFormValue?: (() => unknown) | undefined;
	/**
	 * Whether two values are the same for dirty tracking (a group compares arrays item by item).
	 * Without it, values are compared with `===`.
	 */
	readonly sameValue?: ((a: unknown, b: unknown) => boolean) | undefined;
	/**
	 * Whether the field registers with its form while this control is active (validated and
	 * focused on submit, part of the form's values).
	 * @default true
	 */
	readonly formField?: boolean | undefined;
}

/** A native input a control registers with its field. */
export interface InputRegistration<T extends PlatformTypes = PlatformTypes> {
	/** The value the input stands for in a group. */
	readonly value?: string | undefined;
	/** The element to focus for the input (the visible control the hidden input mirrors). */
	readonly control?: T["element"] | null | undefined;
}

/**
 * The facts a platform passes with a text event, so every text control's intents read them the
 * same way. A clipboard the platform cannot read is passed as `null`, apart from an empty paste.
 */
export interface TextInputSource {
	/** Whether a handler that ran before the control's own prevented the event's default. */
	readonly prevented: boolean;
	/** Whether the text belongs to a composition the input method has not finished. */
	readonly composing?: boolean | undefined;
}

/** What field parts and field-aware controls read from their Field.Root. */
export interface FieldRootView<T extends PlatformTypes = PlatformTypes> {
	/** `true` for the null field a control sees outside `Field.Root`. */
	readonly isNull: boolean;
	/** The field's scheduler, for the timing of its parts. */
	readonly scheduler: Scheduler;
	readonly disabled: boolean;
	readonly name: string | undefined;
	readonly state: Readonly<FieldRootState>;
	/** App-controlled invalidity: the `invalid` prop or a form error. */
	readonly invalid: boolean;
	readonly validityData: FieldValidityData;
	readonly validationMode: FormValidationMode;
	readonly form: FormView<T>;
	/**
	 * Attaches the field's control. The newest attachment owns the field; a release only detaches
	 * while `token` still owns it. Returns the release function.
	 */
	attachControl(token: object, control: FieldControlRegistration<T>): () => void;
	/**
	 * Registers a native input of the control `owner` (its attachment token): while that control is
	 * the active one, the input's validity represents the field. A group's controls register their
	 * inputs under the group's token, each with the value it stands for and its focus target.
	 * Returns the unregister function.
	 */
	registerInput(
		owner: object,
		input: T["element"],
		registration?: InputRegistration<T>,
	): () => void;
	/**
	 * The focus target of the input whose validity represents the field, or `null`.
	 */
	inputControl(): T["element"] | null;
	/** The values of the inputs `owner` registered that a form would submit now. */
	submittedInputValues(owner: object): ReadonlySet<string>;
	setTouched(touched: boolean): void;
	/** Marks the field focused by `owner` (a control). */
	focus(owner: object): void;
	/** Clears the focused state if `owner` holds it. */
	blur(owner: object): void;
	/**
	 * The control's value changed: updates dirty and, with `validate`, clears its form error and
	 * runs change validation.
	 */
	valueChanged(value: unknown, validate: boolean): void;
	/** Validates `value` now. */
	commit(value: unknown): Promise<void>;
	/**
	 * Whether a value change validates now: in `onChange` mode, or in `onSubmit` mode after the
	 * form was submitted.
	 */
	shouldValidateOnChange(): boolean;
	/** A native form reset restored the control to `value`. */
	reset(value: unknown): void;
}

/** What a Field and a nested Fieldset.Root read from their Fieldset.Root. */
export interface FieldsetView {
	/** `true` for the null fieldset seen outside any Fieldset.Root. */
	readonly isNull: boolean;
	readonly disabled: boolean;
	/** The id of the fieldset's legend, once one has mounted (a group control names itself with it). */
	readonly legendId?: string | undefined;
}

/** What labels, descriptions and controls read from their Field.Item. */
export interface FieldItemView {
	readonly disabled: boolean;
}

/** Determines when a field validates. */
export type FormValidationMode = "onSubmit" | "onBlur" | "onChange";

/** Errors keyed by field name, as `Form`'s `errors` prop takes them. */
export type FormErrors = Record<string, string | string[]>;

/** The values of a form's named fields, keyed by name. */
export type FormValues = Record<string, unknown>;

/** A field as a form sees it. `FieldStore` implements it; its getters are live. */
export interface FormField<T extends PlatformTypes = PlatformTypes> {
	readonly name: string | undefined;
	/** The field's validity combined with its external invalid state. */
	readonly combinedValidityData: FieldValidityData;
	/** The element a form focuses when the field is the first invalid one. */
	readonly controlElement: T["element"] | null;
	/** Validates synchronously as far as the validator is synchronous. */
	validate(): void;
	getValue(): unknown;
}

/**
 * What a field reads from its form. `Form` provides a `FormStore` implementing it; outside a
 * `Form` (including inside a plain `<form>`), fields read the null form.
 */
export interface FormView<T extends PlatformTypes = PlatformTypes> {
	/** `true` for the null form a field sees outside `Form`. */
	readonly isNull: boolean;
	readonly errors: FormErrors;
	readonly validationMode: FormValidationMode;
	/** How many times the form was submitted (read at call time, not tracked). */
	readonly submitCount: number;
	/** The form element, once mounted. */
	readonly element: T["element"] | null;
	/** Removes the form error for `name`. */
	clearErrors(name: string | undefined): void;
	/** Registers a field while it has an enabled control. Returns the unregister function. */
	registerField(field: FormField<T>): () => void;
	/** The current values of the registered named fields (a validator's second argument). */
	getValues(): FormValues;
}

/**
 * A labelable scope (Field.Root, Field.Item): the id of the control its label points at, the
 * label's id, and the ids of the messages that describe the control.
 */
export interface LabelableView {
	/** `true` for the null scope a control sees outside any labelable provider. */
	readonly isNull: boolean;
	/**
	 * The `id` of the labelable element. `null` makes the label omit `for` (the control is named
	 * through `aria-labelledby`).
	 */
	readonly controlId: string | null | undefined;
	/** The `id` of the label. */
	readonly labelId: string | undefined;
	/** The ids of the elements that describe the control. */
	readonly messageIds: readonly string[];
	registerControlId(source: symbol, id: string | null | undefined): void;
	resetControlId(): void;
	/** Claims the label id slot for `token`. Returns the release function. */
	registerLabelId(token: object, id: string): () => void;
	/** Adds a describing message id. Returns the removal function. */
	addMessageId(id: string): () => void;
	/** `aria-describedby` for the control: `external` ids, then the parent's and this scope's. */
	describedBy(external: string | undefined | null): string | undefined;
}
