// A field's validity as plain data, and the platform's view of its controls' native validity.

/** A native `ValidityState` as plain data, with `valid` `null` until the field is validated. */
export interface FieldValidityFlags {
	badInput: boolean;
	customError: boolean;
	patternMismatch: boolean;
	rangeOverflow: boolean;
	rangeUnderflow: boolean;
	stepMismatch: boolean;
	tooLong: boolean;
	tooShort: boolean;
	typeMismatch: boolean;
	valueMissing: boolean;
	valid: boolean | null;
}

/** A `ValidityState` flag other than `valid`. */
export type ValidityFlag = Exclude<keyof FieldValidityFlags, "valid">;

export interface FieldValidityData {
	state: FieldValidityFlags;
	error: string;
	errors: string[];
	value: unknown;
	initialValue: unknown;
}

export const DEFAULT_VALIDITY_STATE: Readonly<FieldValidityFlags> = /* @__PURE__ */ Object.freeze({
	badInput: false,
	customError: false,
	patternMismatch: false,
	rangeOverflow: false,
	rangeUnderflow: false,
	stepMismatch: false,
	tooLong: false,
	tooShort: false,
	typeMismatch: false,
	valid: null,
	valueMissing: false,
});

/** The keys of a validity state, in a fixed order (`valid` included). */
export const VALIDITY_KEYS = /* @__PURE__ */ Object.keys(DEFAULT_VALIDITY_STATE) as Array<
	keyof FieldValidityFlags
>;

/** A validity state that is valid, or invalid through a custom error only. */
export function makeValidityState(customError: boolean): FieldValidityFlags {
	return { ...DEFAULT_VALIDITY_STATE, valid: !customError, customError };
}

/**
 * Combines the field's client-side validity data with the external invalid state (the `invalid`
 * prop and form errors) to determine the field's true validity.
 */
export function getCombinedFieldValidityData(
	validityData: FieldValidityData,
	invalid: boolean | undefined,
): FieldValidityData {
	return {
		...validityData,
		state: {
			...validityData.state,
			valid: !invalid && validityData.state.valid,
		},
	};
}

/**
 * What the platform reports about the control that represents a field: a native input's
 * `validity`, `validationMessage` and `willValidate`. Read by the platform layer after the pending
 * updates are flushed, so core never touches the element.
 */
export interface NativeValidity {
	readonly state: Readonly<Record<keyof FieldValidityFlags, boolean>>;
	readonly message: string;
	readonly willValidate: boolean;
}

/** The field's view of its controls' native validity, supplied by the platform layer. */
export interface ValiditySource {
	/** The representative input's validity, or `null` when the field has no eligible input. */
	read(): NativeValidity | null;
	/**
	 * Installs `message` as the representative input's custom validity, remembering a custom
	 * message it displaced.
	 */
	setCustomError(message: string): void;
	/** Withdraws the message installed by `setCustomError`, restoring the one it displaced. */
	clearCustomError(): void;
	/** The input whose validity represents the field, or `null` (one of the registered inputs). */
	representative?(): object | null;
	/** Whether a form would submit `input` now (a registered input, e.g. checked and enabled). */
	isSubmittable?(input: object): boolean;
}

/** A source with no inputs: the field validates its logical value only. */
export const NULL_VALIDITY_SOURCE: ValiditySource = /* @__PURE__ */ Object.freeze({
	read: () => null,
	setCustomError() {},
	clearCustomError() {},
});
