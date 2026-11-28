// SwitchStore: its defaults and binding, a change and a press with their refusals, a form reset,
// what its field and fieldset give it, what a blur means for its field, and what it re-derives.
import { flushSync } from "svelte";
import { describe, expect, it, vi } from "vitest";

import {
	type SwitchRootChangeEventDetails,
	SwitchStore,
	type SwitchStoreProps,
} from "../../../src/components/switch/index.js";
import {
	type FieldRootView,
	type FieldsetView,
	NULL_FIELD,
} from "../../../src/foundation/form/index.js";
import { bound, type PlatformTypes } from "../../../src/foundation/kernel/index.js";
import { changeDetails as details } from "../../kit/kit-details.js";
import { track } from "../../kit/kit-effects.svelte.js";

/** Switch.Root's props as `$state`, the way the component exposes them, with the binding. */
type Props = SwitchStoreProps<PlatformTypes> & { checked: boolean | undefined };
type MutableProps = { -readonly [K in keyof Props]: Props[K] };

const DEFAULTS: MutableProps = {
	checked: undefined,
	defaultChecked: undefined,
	onCheckedChange: undefined,
	disabled: undefined,
	readOnly: undefined,
	required: undefined,
	name: undefined,
	uncheckedValue: undefined,
};

/** The store as Switch.Root builds it, in `field` and `fieldset` when given. */
function setup(
	initial: Partial<MutableProps> = {},
	deps: { field?: FieldRootView; fieldset?: FieldsetView } = {},
) {
	const onCheckedChange = vi.fn();
	const props = $state<MutableProps>({ ...DEFAULTS, onCheckedChange, ...initial });
	const store = new SwitchStore(() => props, {
		checked: bound(
			() => props.checked,
			(next) => (props.checked = next),
		),
		field: deps.field ?? NULL_FIELD,
		fieldset: deps.fieldset,
	});
	return { store, props, onCheckedChange };
}

/** A field that records what the switch tells it. */
function recordingField(validationMode: FieldRootView["validationMode"] = "onSubmit") {
	return {
		...NULL_FIELD,
		isNull: false,
		validationMode,
		setTouched: vi.fn(),
		blur: vi.fn(),
		commit: vi.fn(async () => {}),
	} satisfies FieldRootView;
}

describe("SwitchStore", () => {
	it("applies the defaults", () => {
		const { store } = setup();
		expect(store.checked).toBe(false);
		expect(store.state).toEqual({
			...NULL_FIELD.state,
			checked: false,
			disabled: false,
			readOnly: false,
			required: false,
		});
	});

	it("starts from defaultChecked and writes it to an unset binding", () => {
		const { store, props } = setup({ defaultChecked: true });
		expect(store.checked).toBe(true);
		expect(props.checked).toBe(true);
	});

	describe("setChecked", () => {
		it("calls onCheckedChange with the next value and details, then commits", () => {
			const { store, props, onCheckedChange } = setup();
			const d = details();
			expect(store.setChecked(true, d)).toBe(true);
			expect(onCheckedChange).toHaveBeenCalledWith(true, d);
			expect(store.checked).toBe(true);
			expect(props.checked).toBe(true);
		});

		it("does not commit when onCheckedChange cancels", () => {
			const { store } = setup({
				onCheckedChange: (_checked: boolean, d: SwitchRootChangeEventDetails<PlatformTypes>) =>
					d.cancel(),
			});
			expect(store.setChecked(true, details())).toBe(false);
			expect(store.checked).toBe(false);
		});
	});

	describe("toggle", () => {
		it.each([
			[false, true],
			[true, false],
		])("proposes the opposite of the checked state (%s → %s)", (now, next) => {
			const { store, props, onCheckedChange } = setup({ defaultChecked: now });
			expect(store.toggle(details())).toBe(true);
			expect(onCheckedChange.mock.calls[0]?.[0]).toBe(next);
			expect(props.checked).toBe(next);
		});
	});

	describe("while not interactive", () => {
		it("is interactive unless disabled or read-only", () => {
			const { store, props } = setup();
			expect(store.interactive).toBe(true);
			props.readOnly = true;
			expect(store.interactive).toBe(false);
			props.readOnly = false;
			props.disabled = true;
			expect(store.interactive).toBe(false);
		});

		it.each([["disabled"], ["readOnly"]] as const)("refuses a change when %s", (key) => {
			const { store, props, onCheckedChange } = setup({ [key]: true });
			expect(store.setChecked(true, details())).toBe(false);
			expect(onCheckedChange).not.toHaveBeenCalled();
			expect(store.checked).toBe(false);
			expect(props.checked).toBe(false);
		});

		it.each([["disabled"], ["readOnly"]] as const)("refuses a press when %s", (key) => {
			const { store, props, onCheckedChange } = setup({ [key]: true });
			expect(store.toggle(details())).toBe(false);
			expect(onCheckedChange).not.toHaveBeenCalled();
			expect(props.checked).toBe(false);
		});

		it("still changes when it is interactive", () => {
			const { store, props, onCheckedChange } = setup();
			expect(store.setChecked(true, details())).toBe(true);
			expect(onCheckedChange).toHaveBeenCalledTimes(1);
			expect(store.checked).toBe(true);
			expect(props.checked).toBe(true);
		});
	});

	it("resets to defaultChecked without calling onCheckedChange", () => {
		const { store, onCheckedChange } = setup({ defaultChecked: false, checked: true });
		expect(store.reset()).toBe(true);
		expect(store.checked).toBe(false);
		expect(onCheckedChange).not.toHaveBeenCalled();
	});

	describe("in a field or fieldset", () => {
		it("is disabled by its Fieldset, and not by an enabled one or none", () => {
			expect(setup({}, { fieldset: { isNull: false, disabled: true } }).store.disabled).toBe(true);
			expect(setup({}, { fieldset: { isNull: false, disabled: false } }).store.disabled).toBe(
				false,
			);
			expect(setup().store.disabled).toBe(false);
		});

		it("takes disabled and name from its field", () => {
			const field: FieldRootView = {
				...NULL_FIELD,
				isNull: false,
				disabled: true,
				name: "f",
			};
			const { store } = setup({ name: "own" }, { field });
			expect(store.disabled).toBe(true);
			expect(store.name).toBe("f");
		});
	});

	// What a blur means for a switch in a field: the field is touched and lets go of its focus, and
	// validates the checked state in `onBlur` mode; a disabled switch leaves its field alone.
	describe("focusOut", () => {
		it("touches the field and releases the focus the switch's link holds", () => {
			const field = recordingField();
			const { store } = setup({ checked: true }, { field });
			store.focusOut();
			expect(field.setTouched).toHaveBeenCalledExactlyOnceWith(true);
			expect(field.blur).toHaveBeenCalledExactlyOnceWith(store.link);
			expect(field.commit).not.toHaveBeenCalled();
		});

		it("validates the checked state in onBlur mode", () => {
			const field = recordingField("onBlur");
			const { store } = setup({ checked: true }, { field });
			store.focusOut();
			expect(field.commit).toHaveBeenCalledExactlyOnceWith(true);
		});

		it("leaves the field alone while disabled", () => {
			const field = recordingField("onBlur");
			const { store } = setup({ checked: true, disabled: true }, { field });
			store.focusOut();
			expect(field.setTouched).not.toHaveBeenCalled();
			expect(field.blur).not.toHaveBeenCalled();
			expect(field.commit).not.toHaveBeenCalled();
		});
	});

	describe("reactivity", () => {
		it("re-derives state only when a lens value changes", () => {
			const { store, props } = setup({ disabled: false });
			const state = track(() => store.state);
			// `undefined` → `false` and `false` → `false` leave every lens equal: no new state.
			props.disabled = undefined;
			props.required = false;
			flushSync();
			expect(state.runs).toHaveLength(1);
			props.disabled = true;
			flushSync();
			expect(state.runs).toHaveLength(2);
		});

		it("never tracks onCheckedChange", () => {
			const { store, props } = setup({ onCheckedChange: () => {} });
			const effect = track(() => store.state);
			props.onCheckedChange = () => {};
			flushSync();
			expect(effect.runs.length).toBe(1);
		});
	});
});
