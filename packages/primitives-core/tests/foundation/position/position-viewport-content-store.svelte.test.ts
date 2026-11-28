// ViewportContentStore: when the Viewport's content is created anew (the content key) and when the
// open popup changes from one trigger's content to another's.
import { flushSync } from "svelte";
import { describe, expect, it } from "vitest";

import type { PopupView } from "../../../src/foundation/popup/index.js";
import { ViewportContentStore } from "../../../src/foundation/position/index.js";
import { root } from "../../kit/kit-effects.svelte.js";
import { element as trigger } from "../../kit/kit-stand-ins.js";

type MutableProps = {
	-readonly [
		K in "open" | "mounted" | "activeTriggerId" | "activeTriggerElement" | "payload"
	]: PopupView[K];
};

function setup(initial: Partial<MutableProps> = {}) {
	const props = $state<MutableProps>({
		open: false,
		mounted: false,
		activeTriggerId: null,
		activeTriggerElement: null,
		payload: undefined,
		...initial,
	});
	const store = new ViewportContentStore({ popup: props });
	// Keep the deriveds connected, as the Viewport's `{#key}` block and data attributes do.
	root(() => {
		store.connect();
		$effect(() => {
			void store.contentKey;
			void store.triggerChange;
		});
	});
	flushSync();
	return { props, store };
}

describe("ViewportContentStore", () => {
	describe("contentKey", () => {
		it("changes on every new active trigger id", () => {
			const { props, store } = setup({ activeTriggerId: "a" });
			const first = store.contentKey;

			props.activeTriggerId = "b";
			flushSync();
			const second = store.contentKey;
			expect(second).not.toBe(first);

			props.activeTriggerId = "a";
			flushSync();
			expect(store.contentKey).not.toBe(second);
		});

		it("stays when only the trigger element changes", () => {
			const { props, store } = setup({ activeTriggerId: "a", activeTriggerElement: trigger("a") });
			const key = store.contentKey;

			props.activeTriggerElement = trigger("a again");
			flushSync();
			expect(store.contentKey).toBe(key);
		});

		it("changes once more when the payload arrives an update after its trigger", () => {
			const { props, store } = setup({ activeTriggerId: "a", payload: "A" });

			props.activeTriggerId = "b";
			flushSync();
			const triggerKey = store.contentKey;

			props.payload = "B";
			flushSync();
			const payloadKey = store.contentKey;
			expect(payloadKey).not.toBe(triggerKey);

			// Only once: later payload changes for the same trigger keep the content.
			props.payload = "B2";
			flushSync();
			expect(store.contentKey).toBe(payloadKey);
		});

		it("doesn't wait for a payload that came with its trigger", () => {
			const { props, store } = setup({ activeTriggerId: "a", payload: "A" });

			props.activeTriggerId = "b";
			props.payload = "B";
			flushSync();
			const key = store.contentKey;

			props.payload = "B2";
			flushSync();
			expect(store.contentKey).toBe(key);
		});
	});

	// Svelte re-runs a derived read in an effect teardown with the values from before the flush. A
	// key counted while deriving was bumped again there, so the content remounted spuriously.
	describe("contentKey read in an effect teardown", () => {
		it("changes once per trigger and once for its late payload", () => {
			const { props, store } = setup({ activeTriggerId: "a", payload: "A" });
			const keys: number[] = [];
			root(() => {
				$effect(() => {
					void store.contentKey;
					return () => {
						keys.push(store.contentKey);
					};
				});
			});
			flushSync();
			const first = store.contentKey;

			props.activeTriggerId = "b";
			flushSync();
			const triggerKey = store.contentKey;
			expect(triggerKey).toBe(first + 1);

			props.payload = "B";
			flushSync();
			expect(store.contentKey).toBe(first + 2);

			props.payload = "B2";
			flushSync();
			expect(store.contentKey).toBe(first + 2);
			expect(keys.length).toBeGreaterThan(0);
		});
	});

	describe("contentKey before connect()", () => {
		it("commits a trigger change made before connect(), so its late payload re-creates", () => {
			const props = $state<MutableProps>({
				open: false,
				mounted: false,
				activeTriggerId: "a",
				activeTriggerElement: null,
				payload: "A",
			});
			const store = new ViewportContentStore({ popup: props });
			const first = store.contentKey;
			props.activeTriggerId = "b";
			root(() => {
				store.connect();
				$effect(() => {
					void store.contentKey;
				});
			});
			flushSync();
			expect(store.contentKey).toBe(first + 1);
			props.payload = "B";
			flushSync();
			expect(store.contentKey).toBe(first + 2);
		});
	});

	describe("triggerChange", () => {
		const a = trigger("a");
		const b = trigger("b");

		function setupOpen() {
			const context = setup({
				open: true,
				mounted: true,
				activeTriggerId: "a",
				activeTriggerElement: a,
			});
			context.store.settle();
			flushSync();
			return context;
		}

		it("is null until the popup has shown a trigger's content", () => {
			const { props, store } = setup({
				open: true,
				mounted: true,
				activeTriggerId: "a",
				activeTriggerElement: a,
			});
			expect(store.triggerChange).toBe(null);

			props.activeTriggerId = "b";
			props.activeTriggerElement = b;
			flushSync();
			expect(store.triggerChange).toBe(null);
		});

		it("goes from the shown trigger to the active one until settled", () => {
			const { props, store } = setupOpen();
			expect(store.triggerChange).toBe(null);

			props.activeTriggerId = "b";
			props.activeTriggerElement = b;
			flushSync();
			expect(store.triggerChange).toEqual({ from: a, to: b });

			store.settle();
			flushSync();
			expect(store.triggerChange).toBe(null);
		});

		it("changes when the same trigger id moves to a new element", () => {
			const { props, store } = setupOpen();
			const replacement = trigger("a, re-created");

			props.activeTriggerElement = replacement;
			flushSync();
			expect(store.triggerChange).toEqual({ from: a, to: replacement });
		});

		it("doesn't change while closed or unmounted", () => {
			const { props, store } = setupOpen();

			props.open = false;
			props.activeTriggerElement = b;
			flushSync();
			expect(store.triggerChange).toBe(null);

			props.open = true;
			props.mounted = false;
			flushSync();
			expect(store.triggerChange).toBe(null);
		});

		it("doesn't change on reopening after settling closed", () => {
			const { props, store } = setupOpen();

			props.open = false;
			flushSync();
			store.settle();

			props.activeTriggerId = "b";
			props.activeTriggerElement = b;
			props.open = true;
			flushSync();
			expect(store.triggerChange).toBe(null);
		});
	});
});
