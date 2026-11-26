import { untrack } from "svelte";

import {
	FieldControlLink,
	type FieldRootContextValue,
	type FieldsetContextValue,
} from "../../foundation/form/index.js";
import { type Bound, Controllable, type PlatformTypes } from "../../foundation/kernel/index.js";
import type { SwitchRootChangeEventDetails, SwitchRootState } from "./types.js";

/** The Switch.Root props the store reads. */
export interface SwitchStoreProps<T extends PlatformTypes> {
	/** Whether the switch is initially on. */
	readonly defaultChecked: boolean | undefined;
	/** Called with a proposed checked state, before it is written. */
	readonly onCheckedChange:
		| ((checked: boolean, details: SwitchRootChangeEventDetails<T>) => void)
		| undefined;
	/** Whether the switch ignores user interaction. */
	readonly disabled: boolean | undefined;
	/** Whether the user may not change the switch. */
	readonly readOnly: boolean | undefined;
	/** Whether the switch must be on before a form submits. */
	readonly required: boolean | undefined;
	/** The switch's own name, used when its Field has none. */
	readonly name: string | undefined;
	/** The value a form gets while the switch is off. */
	readonly uncheckedValue: string | undefined;
}

/** What a switch is given once, when it is built. */
export interface SwitchStoreDeps<T extends PlatformTypes> {
	/** The `checked` binding. */
	readonly checked: Bound<boolean | undefined>;
	/** The field the switch is in: `NULL_FIELD` outside a Field. */
	readonly field: FieldRootContextValue<T>;
	/** The fieldset around the switch: disabling it disables the switch. Absent means not disabled. */
	readonly fieldset?: FieldsetContextValue | undefined;
}

/** A switch's state and the changes it accepts. */
export class SwitchStore<T extends PlatformTypes = PlatformTypes> {
	// 1. Inputs
	readonly #props: () => SwitchStoreProps<T>;
	readonly #field: FieldRootContextValue<T>;
	readonly #fieldset: FieldsetContextValue | undefined;

	// 2. Owned objects
	/** The checked state: the `checked` binding when controlled, else the store's own. */
	readonly #checked: Controllable<boolean>;
	/** The switch as its field sees it: value, name, filled, disabled. */
	readonly link: FieldControlLink<T>;

	// 3. Public state. `$derived.by` because `#props` is assigned in the constructor, after these
	// initialisers (deriveds are lazy; TS rejects a plain `$derived(this.#props()…)` with TS2729).
	/** Whether the switch is initially on. */
	readonly defaultChecked: boolean = $derived.by(() => Boolean(this.#props().defaultChecked));
	/** Whether the switch ignores user interaction: its own prop, its field's or its fieldset's. */
	readonly disabled: boolean = $derived.by(
		() =>
			this.#field.disabled ||
			(this.#fieldset?.disabled ?? false) ||
			(this.#props().disabled ?? false),
	);
	/** Whether the user may not change the switch. */
	readonly readOnly: boolean = $derived.by(() => this.#props().readOnly ?? false);
	/** Whether the switch must be on before a form submits. */
	readonly required: boolean = $derived.by(() => this.#props().required ?? false);
	/** The submitted name: the Field's, else the switch's own. */
	readonly name: string | undefined = $derived.by(() => this.#field.name ?? this.#props().name);
	/** Whether the user may change the switch: it is neither disabled nor read-only. */
	readonly interactive: boolean = $derived(!this.disabled && !this.readOnly);
	/** Whether the form gets `uncheckedValue`: the switch is off, named, and has one. */
	readonly submitsUncheckedValue: boolean = $derived.by(
		() => !this.checked && Boolean(this.name) && this.#props().uncheckedValue !== undefined,
	);
	/** Switch.Root's and Switch.Thumb's state. */
	readonly state: SwitchRootState = $derived.by(() => ({
		...this.#field.state,
		checked: this.checked,
		disabled: this.disabled,
		readOnly: this.readOnly,
		required: this.required,
	}));

	/**
	 * Pure: reads no context, so it can be built anywhere. `props` is called inside the deriveds,
	 * so each prop stays reactive.
	 */
	constructor(props: () => SwitchStoreProps<T>, deps: SwitchStoreDeps<T>) {
		this.#props = props;
		this.#field = deps.field;
		this.#fieldset = deps.fieldset;
		this.#checked = new Controllable<boolean>(deps.checked, {
			default: () => this.defaultChecked,
			name: "Switch",
			state: "checked",
		});
		this.link = new FieldControlLink(deps.field, () => ({
			value: this.checked,
			name: props().name,
			filled: this.checked,
			disabled: this.disabled,
		}));
	}

	/** The field the switch is in. */
	get field(): FieldRootContextValue<T> {
		return this.#field;
	}

	/** Whether the switch is on. */
	get checked(): boolean {
		return this.#checked.current;
	}

	// 4. Intents
	/**
	 * Proposes a checked state. Calls `onCheckedChange` first. A switch that is disabled or
	 * read-only refuses the change without calling it. Returns `false` when it was refused,
	 * canceled or a function binding declined, so the caller can undo the native toggle.
	 */
	setChecked = (next: boolean, details: SwitchRootChangeEventDetails<T>): boolean => {
		if (!this.interactive) {
			return false;
		}
		return this.#checked.set(next, details, this.#props().onCheckedChange);
	};

	/** A press: proposes the opposite of `checked` through `setChecked`, with its refusals. */
	toggle = (details: SwitchRootChangeEventDetails<T>): boolean =>
		this.setChecked(!untrack(() => this.checked), details);

	/**
	 * A form reset: back to `defaultChecked` without calling `onCheckedChange`, since a reset is not
	 * a user change, and the field's validity goes back to neutral.
	 */
	reset = (): boolean => {
		const written = this.#checked.reset();
		this.link.reset();
		return written;
	};

	/** The control lost focus. A disabled switch does not touch its field. */
	focusOut = (): void => {
		if (!this.disabled) {
			this.link.blur(this.checked);
		}
	};

	// 5. Lifetime
	/** Development warnings and the field link. Called once by Switch.Root. */
	connect(): void {
		this.#checked.connect();
		this.link.connect();
	}
}
