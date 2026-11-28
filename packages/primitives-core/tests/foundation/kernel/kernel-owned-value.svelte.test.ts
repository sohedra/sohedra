import { flushSync } from "svelte";
import { afterEach, describe, expect, it, vi } from "vitest";

import { OwnedValue } from "../../../src/foundation/kernel/index.js";
import { useClaim } from "../../../src/foundation/kernel/kernel-owned-value.svelte.js";

const roots: (() => void)[] = [];
afterEach(() => {
	roots.splice(0).forEach((cleanup) => cleanup());
});

describe("OwnedValue", () => {
	it("is unclaimed at first", () => {
		expect(new OwnedValue<string>().current).toBeUndefined();
	});

	it("is owned by the newest claim; a stale release is ignored", () => {
		const slot = new OwnedValue<string>();
		const releaseA = slot.claim({}, "a");
		const releaseB = slot.claim({}, "b");
		expect(slot.current).toBe("b");
		releaseA();
		expect(slot.current).toBe("b");
		releaseB();
		expect(slot.current).toBeUndefined();
	});

	it("lets the owner re-claim with a new value", () => {
		const slot = new OwnedValue<string>();
		const token = {};
		const first = slot.claim(token, "a");
		const second = slot.claim(token, "b");
		expect(slot.current).toBe("b");
		// Same token: either release clears the slot.
		first();
		expect(slot.current).toBeUndefined();
		second();
		expect(slot.current).toBeUndefined();
	});
});

describe("useClaim", () => {
	it("claims after mount, re-claims on change, and releases on undefined and teardown", () => {
		const slot = new OwnedValue<string>();
		const claim = vi.spyOn(slot, "claim");
		let id = $state<string | undefined>("a");
		const cleanup = $effect.root(() =>
			useClaim(
				(token, value) => slot.claim(token, value),
				() => id,
			),
		);
		roots.push(cleanup);
		// Effect timing: nothing is claimed until the effects flush.
		expect(slot.current).toBeUndefined();
		flushSync();
		expect(slot.current).toBe("a");

		id = "b";
		flushSync();
		expect(slot.current).toBe("b");
		// One token for the part's lifetime.
		expect(claim.mock.calls[0][0]).toBe(claim.mock.calls[1][0]);

		id = undefined;
		flushSync();
		expect(slot.current).toBeUndefined();

		id = "c";
		flushSync();
		expect(slot.current).toBe("c");
		cleanup();
		expect(slot.current).toBeUndefined();
	});

	it("does not let an outgoing part clear its replacement's claim", () => {
		const slot = new OwnedValue<string>();
		const outgoing = $effect.root(() => useClaim(slot.claim.bind(slot), () => "old"));
		flushSync();
		roots.push($effect.root(() => useClaim(slot.claim.bind(slot), () => "new")));
		flushSync();
		expect(slot.current).toBe("new");
		// The outgoing part tears down late (an `out:` transition).
		outgoing();
		expect(slot.current).toBe("new");
	});
});
