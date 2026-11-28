// ViewportContentStore: when the Viewport's content is created anew (the content key) and when the
// open popup switches from one trigger's content to another's.
import { flushSync } from "svelte";
import { describe, expect, it } from "vitest";

import { ViewportContentStore } from "../../../src/foundation/position/index.js";
import type { ViewportContentStoreProps } from "../../../src/foundation/position/position-viewport-content-store.svelte.js";
import { root } from "../../kit/kit-effects.svelte.js";
import { element as trigger } from "../../kit/kit-stand-ins.js";

type MutableProps = {
	-readonly [K in keyof ViewportContentStoreProps]: ViewportContentStoreProps[K];
};

function setup(initial: Partial<MutableProps> = {}) {
	const props = $state<MutableProps>({
		open: false,
		mounted: false,
		activeTriggerId: null,
		activeTrigger: null,
		payload: undefined,
		...initial,
	});
	const store = new ViewportContentStore(() => props);
	// Keep the deriveds connected, as the Viewport's `{#key}` block and data attributes do.
	root(() => {
		store.connect();
		$effect(() => {
			void store.contentKey;
			void store.switching;
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
			const { props, store } = setup({ activeTriggerId: "a", activeTrigger: trigger("a") });
			const key = store.contentKey;

			props.activeTrigger = trigger("a again");
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
				activeTrigger: null,
				payload: "A",
			});
			const store = new ViewportContentStore(() => props);
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

	describe("switching", () => {
		const a = trigger("a");
		const b = trigger("b");

		function setupOpen() {
			const context = setup({ open: true, mounted: true, activeTriggerId: "a", activeTrigger: a });
			context.store.settle();
			flushSync();
			return context;
		}

		it("is null until the popup has shown a trigger's content", () => {
			const { props, store } = setup({
				open: true,
				mounted: true,
				activeTriggerId: "a",
				activeTrigger: a,
			});
			expect(store.switching).toBe(null);

			props.activeTriggerId = "b";
			props.activeTrigger = b;
			flushSync();
			expect(store.switching).toBe(null);
		});

		it("goes from the shown trigger to the active one until settled", () => {
			const { props, store } = setupOpen();
			expect(store.switching).toBe(null);

			props.activeTriggerId = "b";
			props.activeTrigger = b;
			flushSync();
			expect(store.switching).toEqual({ from: a, to: b });

			store.settle();
			flushSync();
			expect(store.switching).toBe(null);
		});

		it("switches when the same trigger id moves to a new element", () => {
			const { props, store } = setupOpen();
			const replacement = trigger("a, re-created");

			props.activeTrigger = replacement;
			flushSync();
			expect(store.switching).toEqual({ from: a, to: replacement });
		});

		it("doesn't switch while closed or unmounted", () => {
			const { props, store } = setupOpen();

			props.open = false;
			props.activeTrigger = b;
			flushSync();
			expect(store.switching).toBe(null);

			props.open = true;
			props.mounted = false;
			flushSync();
			expect(store.switching).toBe(null);
		});

		it("doesn't switch on reopening after settling closed", () => {
			const { props, store } = setupOpen();

			props.open = false;
			flushSync();
			store.settle();

			props.activeTriggerId = "b";
			props.activeTrigger = b;
			props.open = true;
			flushSync();
			expect(store.switching).toBe(null);
		});
	});
});
