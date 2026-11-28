// A field-aware control's link to its field: attachment, dirty tracking and validation on change.
import { untrack } from "svelte";

import { type PlatformTypes, watch } from "../kernel/index.js";
import type { FieldControlRegistration, FieldRootView } from "./form-types.js";

/** What a field-aware control's link reads of it, from its props function. */
export interface FieldControlLinkProps<T extends PlatformTypes = PlatformTypes> {
	/** The value the field validates and compares with its baseline. */
	readonly value: unknown;
	/** The control's own name. */
	readonly name: string | undefined;
	/** Whether the control holds a value. */
	readonly filled: boolean;
	/** The control's effective disabled state (its field's or its own). */
	readonly disabled: boolean;
	/**
	 * The element a form focuses, for a control whose focus target isn't its own element (a group
	 * focuses one of its inputs' controls). Without it, the attached element.
	 */
	readonly getElement?: (() => T["element"] | null) | undefined;
	/** See {@link FieldControlRegistration.getFormValue}. */
	readonly getFormValue?: (() => unknown) | undefined;
	/** See {@link FieldControlRegistration.sameValue}. */
	readonly sameValue?: ((a: unknown, b: unknown) => boolean) | undefined;
	/** See {@link FieldControlRegistration.formField}. */
	readonly formField?: boolean | undefined;
}

/**
 * Connects a control to its field under an owner token and turns value changes into the field's
 * dirty and validation state. A change the field hasn't seen is programmatic and validates as a
 * controlled value; a user change is bracketed by `beginUserChange` and `endUserChange`.
 */
export class FieldControlLink<
	T extends PlatformTypes = PlatformTypes,
> implements FieldControlRegistration<T> {
	readonly #field: FieldRootView<T>;
	readonly #props: () => FieldControlLinkProps<T>;
	#seen: unknown;

	#element: T["element"] | null = $state.raw(null);

	// An array value is copied, so the copy tracks its items: mutating a bound array in place is a
	// change the field sees, as reassigning it is.
	readonly #value = $derived.by(() => {
		const value = this.#props().value;
		return Array.isArray(value) ? value.slice() : value;
	});

	/** The control's value as its form submits it, when it differs from `value`; read once. */
	readonly getFormValue: (() => unknown) | undefined;
	/** How the field compares two values for dirtiness, when not by identity; read once. */
	readonly sameValue: ((a: unknown, b: unknown) => boolean) | undefined;

	/**
	 * Pure: reads no context. `props` is called inside the deriveds and getters, so each value stays
	 * live; the two functions in it are read once, here.
	 */
	constructor(props: () => FieldControlLinkProps<T>, deps: { readonly field: FieldRootView<T> }) {
		this.#field = deps.field;
		this.#props = props;
		this.#seen = this.#value;
		const { getFormValue, sameValue } = props();
		this.getFormValue = getFormValue;
		this.sameValue = sameValue;
	}

	/** Whether the control counts as its field's form value; `true` unless the props say not. */
	get formField(): boolean {
		return this.#props().formField ?? true;
	}

	/** The control's value; an array value is a copy, so changing its items in place is a change. */
	get value(): unknown {
		return this.#value;
	}

	/** The control's own name. */
	get name(): string | undefined {
		return this.#props().name;
	}

	/** Whether the control holds a value. */
	get filled(): boolean {
		return this.#props().filled;
	}

	/** The control's effective disabled state. */
	get disabled(): boolean {
		return this.#props().disabled;
	}

	/** The control's focus target, attached by the platform. */
	get element(): T["element"] | null {
		const getElement = this.#props().getElement;
		return getElement ? getElement() : this.#element;
	}

	/**
	 * The control's focus target was attached. Returns the release function, which only clears the
	 * element while it is still this one.
	 */
	attachElement = (element: T["element"]): (() => void) => {
		this.#element = element;
		return () => {
			if (this.#element === element) {
				this.#element = null;
			}
		};
	};

	/** A user change was committed: the field must not treat it as programmatic. */
	beginUserChange = (): void => {
		this.#seen = untrack(() => this.#value);
	};

	/** Takes the current value as seen, without reporting a change (hydration, a new default). */
	markSeen = (): void => {
		this.#seen = untrack(() => this.#value);
	};

	/** Reports the user change after the flush; `validate` is `false` for a prevented event. */
	endUserChange = (validate: boolean): void => {
		this.#field.valueChanged(this.#seen, validate);
	};

	/** The control took focus: its field is focused, unless the control is disabled. */
	focus = (): void => {
		if (!untrack(() => this.disabled)) {
			this.#field.focus(this);
		}
	};

	/**
	 * The control no longer holds focus, without a blur the field counts: it was disabled or
	 * unmounted while focused. The field lets go of the focused state this link holds.
	 */
	releaseFocus = (): void => {
		this.#field.blur(this);
	};

	/**
	 * The control lost focus: its field is touched and lets go of its focused state, and validates
	 * `value` in `onBlur` mode.
	 */
	blur = (value: unknown): void => {
		this.#field.setTouched(true);
		this.releaseFocus();
		if (this.#field.validationMode === "onBlur") {
			void this.#field.commit(value);
		}
	};

	/**
	 * A form reset restored the control. Nothing validates and validity goes back to neutral, as on
	 * a freshly loaded form.
	 */
	reset = (): void => {
		this.#seen = untrack(() => this.#value);
		this.#field.reset(this.#seen);
	};

	/** Attaches to the field and watches for programmatic changes. Call once during init. */
	connect(): void {
		// The control stays attached to its field while it lives; the release runs at teardown.
		$effect(() => untrack(() => this.#field.attachControl(this, this)));
		// A value the field hasn't seen yet is a programmatic change; a user change was seen first.
		watch(
			() => this.#value,
			(value) => {
				if (Object.is(value, this.#seen)) {
					return;
				}
				this.#seen = value;
				this.#field.valueChanged(value, true);
			},
			{ lazy: true },
		);
	}
}
