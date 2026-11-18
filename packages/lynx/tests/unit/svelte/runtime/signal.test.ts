// The signal a deferred row's `{#if}` reads: written while Svelte builds a block (the renderer shows
// a row as a block effect inserts it), it does not throw, and its readers see the value.

import { describe, expect, it } from "@rstest/core";
// @ts-expect-error -- Svelte publishes no types for its internal modules; the cast below gives these ones'.
import * as internal from "svelte/internal/client";

import { signal } from "../../../../src/svelte/runtime/index.ts";

// Boundary: the functions of Svelte's client runtime the test reads, typed by what they do.
const { derived, get } = internal as {
	derived(run: () => unknown): object;
	get(signal: object): unknown;
};

describe("a signal", () => {
	it("is written while Svelte computes a derived or builds a block, without an error", () => {
		const opened = signal(false);
		const writes = derived(() => opened.write(true));
		expect(() => get(writes)).not.toThrow();
		expect(opened.read()).toBe(true);
	});
});
