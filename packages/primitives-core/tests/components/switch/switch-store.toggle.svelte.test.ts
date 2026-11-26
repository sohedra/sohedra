// A press proposes the opposite of `checked`.
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

describe("SwitchStore.toggle", () => {
	it.each([
		[false, true],
		[true, false],
	])("proposes the opposite of the checked state (%s → %s)", (now, next) => {
		const { store, props, onCheckedChange } = setup({ defaultChecked: now });
		expect(store.toggle(details())).toBe(true);
		expect(onCheckedChange.mock.calls[0]?.[0]).toBe(next);
		expect(props.checked).toBe(next);
	});

	it.each([["disabled"], ["readOnly"]] as const)("refuses a press when %s", (key) => {
		const { store, props, onCheckedChange } = setup({ [key]: true });
		expect(store.toggle(details())).toBe(false);
		expect(onCheckedChange).not.toHaveBeenCalled();
		expect(props.checked).toBe(false);
	});
});
