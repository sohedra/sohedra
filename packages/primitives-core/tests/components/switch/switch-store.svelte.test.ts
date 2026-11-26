import { flushSync } from "svelte";
import { describe, expect, it, vi } from "vitest";

import {
	type SwitchRootChangeEventDetails,
	SwitchStore,
	type SwitchStoreProps,
} from "../../../src/components/switch/index.js";
import { type FieldRootContextValue, NULL_FIELD } from "../../../src/foundation/form/index.js";
import {
	bound,
	createChangeEventDetails,
	type PlatformTypes,
	REASONS,
} from "../../../src/foundation/kernel/index.js";

const event = { type: "click" } as unknown as Event;
const details = () => createChangeEventDetails(REASONS.none, event);

/** Switch.Root's props as `$state`, the way the component exposes them, with the binding. */
type Props = SwitchStoreProps<PlatformTypes> & { checked: boolean | undefined };
type MutableProps = { -readonly [K in keyof Props]: Props[K] };

function createProps(initial: Partial<MutableProps>) {
	const props = $state<MutableProps>({
		checked: undefined,
		defaultChecked: undefined,
		onCheckedChange: undefined,
		disabled: undefined,
		readOnly: undefined,
		required: undefined,
		name: undefined,
		uncheckedValue: undefined,
		...initial,
	});
	return props;
}

/** The store as Switch.Root builds it. */
function createStore(
	props: MutableProps,
	field: FieldRootContextValue = NULL_FIELD,
	fieldset?: { isNull: boolean; disabled: boolean },
) {
	return new SwitchStore(() => props, {
		checked: bound(
			() => props.checked,
			(next) => (props.checked = next),
		),
		field,
		fieldset,
	});
}

const DISABLED_FIELDSET = { isNull: false, disabled: true };

describe("SwitchStore", () => {
	it("applies the defaults", () => {
		const store = createStore(createProps({}));
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
		const props = createProps({ defaultChecked: true });
		const store = createStore(props);
		expect(store.checked).toBe(true);
		expect(props.checked).toBe(true);
	});

	it("calls onCheckedChange with the next value and details, then commits", () => {
		const onCheckedChange = vi.fn();
		const props = createProps({ onCheckedChange });
		const store = createStore(props);
		const d = details();
		expect(store.setChecked(true, d)).toBe(true);
		expect(onCheckedChange).toHaveBeenCalledWith(true, d);
		expect(store.checked).toBe(true);
		expect(props.checked).toBe(true);
	});

	it("does not commit when onCheckedChange cancels", () => {
		const props = createProps({
			onCheckedChange: (_checked: boolean, d: SwitchRootChangeEventDetails<PlatformTypes>) =>
				d.cancel(),
		});
		const store = createStore(props);
		expect(store.setChecked(true, details())).toBe(false);
		expect(store.checked).toBe(false);
	});

	it("resets to defaultChecked without calling onCheckedChange", () => {
		const onCheckedChange = vi.fn();
		const props = createProps({ defaultChecked: false, checked: true, onCheckedChange });
		const store = createStore(props);
		expect(store.reset()).toBe(true);
		expect(store.checked).toBe(false);
		expect(onCheckedChange).not.toHaveBeenCalled();
	});

	it("is interactive unless disabled or read-only", () => {
		const props = createProps({});
		const store = createStore(props);
		expect(store.interactive).toBe(true);
		props.readOnly = true;
		expect(store.interactive).toBe(false);
		props.readOnly = false;
		props.disabled = true;
		expect(store.interactive).toBe(false);
	});

	it("is disabled by its Fieldset, and not by an enabled one or none", () => {
		expect(createStore(createProps({}), NULL_FIELD, DISABLED_FIELDSET).disabled).toBe(true);
		expect(
			createStore(createProps({}), NULL_FIELD, { isNull: false, disabled: false }).disabled,
		).toBe(false);
		expect(createStore(createProps({})).disabled).toBe(false);
	});

	it("takes disabled and name from its field", () => {
		const field: FieldRootContextValue = {
			...NULL_FIELD,
			isNull: false,
			disabled: true,
			name: "f",
		};
		const store = createStore(createProps({ name: "own" }), field);
		expect(store.disabled).toBe(true);
		expect(store.name).toBe("f");
	});

	it("re-derives state only when a lens value changes", () => {
		const props = createProps({ disabled: false });
		const store = createStore(props);
		const seen: unknown[] = [];
		const cleanup = $effect.root(() => {
			$effect(() => {
				seen.push(store.state);
			});
		});
		flushSync();
		// `undefined` → `false` and `false` → `false` leave every lens equal: no new state.
		props.disabled = undefined;
		props.required = false;
		flushSync();
		expect(seen).toHaveLength(1);
		props.disabled = true;
		flushSync();
		expect(seen).toHaveLength(2);
		cleanup();
	});

	it("never tracks onCheckedChange", () => {
		const props = createProps({ onCheckedChange: () => {} });
		const store = createStore(props);
		let runs = 0;
		const cleanup = $effect.root(() => {
			$effect(() => {
				runs += 1;
				void store.state;
			});
		});
		flushSync();
		props.onCheckedChange = () => {};
		flushSync();
		expect(runs).toBe(1);
		cleanup();
	});
});
