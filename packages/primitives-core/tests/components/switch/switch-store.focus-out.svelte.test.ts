// What a blur means for a switch in a field: the field is touched and lets go of its focus, and
// validates the checked state in `onBlur` mode; a disabled switch leaves its field alone.
import { describe, expect, it, vi } from "vitest";

import { SwitchStore } from "../../../src/components/switch/index.js";
import {
	type FieldRootContextValue,
	type FormValidationMode,
	NULL_FIELD,
} from "../../../src/foundation/form/index.js";
import { bound } from "../../../src/foundation/kernel/index.js";

function setup(options: { disabled?: boolean; validationMode?: FormValidationMode } = {}) {
	const field = {
		...NULL_FIELD,
		isNull: false,
		validationMode: options.validationMode ?? "onSubmit",
		setTouched: vi.fn(),
		blur: vi.fn(),
		commit: vi.fn(async () => {}),
	} satisfies FieldRootContextValue;
	let checked: boolean | undefined = true;
	const store = new SwitchStore(
		() => ({
			defaultChecked: undefined,
			onCheckedChange: undefined,
			disabled: options.disabled,
			readOnly: undefined,
			required: undefined,
			name: undefined,
			uncheckedValue: undefined,
		}),
		{
			checked: bound(
				() => checked,
				(next) => (checked = next),
			),
			field,
		},
	);
	return { store, field };
}

describe("SwitchStore.focusOut", () => {
	it("touches the field and releases the focus the switch's link holds", () => {
		const { store, field } = setup();
		store.focusOut();
		expect(field.setTouched).toHaveBeenCalledExactlyOnceWith(true);
		expect(field.blur).toHaveBeenCalledExactlyOnceWith(store.link);
		expect(field.commit).not.toHaveBeenCalled();
	});

	it("validates the checked state in onBlur mode", () => {
		const { store, field } = setup({ validationMode: "onBlur" });
		store.focusOut();
		expect(field.commit).toHaveBeenCalledExactlyOnceWith(true);
	});

	it("leaves the field alone while disabled", () => {
		const { store, field } = setup({ disabled: true, validationMode: "onBlur" });
		store.focusOut();
		expect(field.setTouched).not.toHaveBeenCalled();
		expect(field.blur).not.toHaveBeenCalled();
		expect(field.commit).not.toHaveBeenCalled();
	});
});
