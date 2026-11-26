// A switch that is not interactive refuses a change.
import { describe, expect, it, vi } from "vitest";

import { SwitchStore, type SwitchStoreProps } from "../../../src/components/switch/index.js";
import { NULL_FIELD } from "../../../src/foundation/form/index.js";
import {
	bound,
	createChangeEventDetails,
	type PlatformTypes,
	REASONS,
} from "../../../src/foundation/kernel/index.js";

const details = () => createChangeEventDetails(REASONS.none, { type: "click" } as unknown as Event);

type Props = SwitchStoreProps<PlatformTypes> & { checked: boolean | undefined };
type MutableProps = { -readonly [K in keyof Props]: Props[K] };

function setup(initial: Partial<MutableProps>) {
	const onCheckedChange = vi.fn();
	const props = $state<MutableProps>({
		checked: undefined,
		defaultChecked: undefined,
		onCheckedChange,
		disabled: undefined,
		readOnly: undefined,
		required: undefined,
		name: undefined,
		uncheckedValue: undefined,
		...initial,
	});
	const store = new SwitchStore(() => props, {
		checked: bound(
			() => props.checked,
			(next) => (props.checked = next),
		),
		field: NULL_FIELD,
	});
	return { store, props, onCheckedChange };
}

describe("SwitchStore.setChecked while not interactive", () => {
	it.each([["disabled"], ["readOnly"]] as const)("refuses a change when %s", (key) => {
		const { store, props, onCheckedChange } = setup({ [key]: true });
		expect(store.setChecked(true, details())).toBe(false);
		expect(onCheckedChange).not.toHaveBeenCalled();
		expect(store.checked).toBe(false);
		expect(props.checked).toBe(false);
	});

	it("still changes when it is interactive", () => {
		const { store, props, onCheckedChange } = setup({});
		expect(store.setChecked(true, details())).toBe(true);
		expect(onCheckedChange).toHaveBeenCalledTimes(1);
		expect(store.checked).toBe(true);
		expect(props.checked).toBe(true);
	});
});
