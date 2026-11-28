// ActiveTriggerStore's anchor: the active trigger, or the last one after the popup unmounts, also
// when an effect teardown reads it.
import { flushSync } from "svelte";
import { describe, expect, it } from "vitest";

import { bound } from "../../../src/foundation/kernel/index.js";
import {
	ActiveTriggerStore,
	type ActiveTriggerStoreProps,
} from "../../../src/foundation/popup/popup-active-trigger-store.svelte.js";
import { PopupTriggerMap } from "../../../src/foundation/popup/popup-trigger-map.js";
import type { InstantType } from "../../../src/foundation/popup/popup-types.js";
import { root } from "../../kit/kit-effects.svelte.js";

type MutableProps = { -readonly [K in keyof ActiveTriggerStoreProps]: ActiveTriggerStoreProps[K] };

function setup() {
	const props = $state<MutableProps>({
		open: true,
		mounted: true,
		triggerId: undefined,
		defaultTriggerId: undefined,
	});
	let instant: InstantType = $state();
	const store = new ActiveTriggerStore(() => props, {
		triggers: new PopupTriggerMap(),
		instant: bound(
			() => instant,
			(value) => (instant = value),
		),
	});
	root(() => store.connect());
	flushSync();
	return { props, store };
}

describe("ActiveTriggerStore", () => {
	describe("anchor", () => {
		it("keeps the last trigger after the popup unmounts", () => {
			const { props, store } = setup();
			const a = { name: "a" };
			store.set("a", a);
			flushSync();
			expect(store.anchor).toBe(a);
			props.mounted = false;
			props.open = false;
			flushSync();
			expect(store.element).toBeNull();
			expect(store.anchor).toBe(a);
			store.forgetLastTrigger();
			flushSync();
			expect(store.anchor).toBeNull();
		});

		// Svelte re-runs a derived read in an effect teardown with the values from before the flush. A
		// reference remembered while deriving rewound to the previous trigger there.
		it("keeps the current trigger when an effect teardown reads it", () => {
			const { props, store } = setup();
			const a = { name: "a" };
			const b = { name: "b" };
			store.set("a", a);
			flushSync();
			const seen: unknown[] = [];
			root(() => {
				$effect(() => {
					void store.anchor;
					return () => {
						seen.push(store.anchor);
					};
				});
			});
			flushSync();
			store.set("b", b);
			flushSync();
			expect(store.anchor).toBe(b);
			props.mounted = false;
			props.open = false;
			flushSync();
			expect(seen).toContain(a);
			expect(store.anchor).toBe(b);
		});
	});
});
