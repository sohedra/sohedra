// `withRenderer`: the renderer Svelte draws with while a call runs, and the one before it after,
// whether the call returns or throws.

import { describe, expect, it } from "@rstest/core";
// @ts-expect-error -- Svelte publishes no types for its internal modules; the casts below give these ones'.
import { pop_renderer, push_renderer } from "svelte/internal/client";

import { withRenderer } from "../../../../src/svelte/runtime/index.ts";

// Boundary: Svelte's functions, typed by what they do.
const push = push_renderer as (renderer: object | null) => object | null;
const pop = pop_renderer as (previous: object | null) => void;

/** The renderer current now. */
function current(): object | null {
	const now = push(null);
	pop(now);
	return now;
}

describe("withRenderer", () => {
	const outer = { name: "outer" };
	const inner = { name: "inner" };

	it("makes the renderer current while the call runs, returns its value, and restores the one before", () => {
		const before = push(outer);
		try {
			expect(withRenderer(inner, () => current())).toBe(inner);
			expect(current()).toBe(outer);
		} finally {
			pop(before);
		}
	});

	it("restores the renderer before when the call throws", () => {
		const before = push(outer);
		try {
			expect(() =>
				withRenderer(inner, () => {
					throw new Error("the handler threw");
				}),
			).toThrow("the handler threw");
			expect(current()).toBe(outer);
		} finally {
			pop(before);
		}
		expect(current()).toBe(before);
	});
});
