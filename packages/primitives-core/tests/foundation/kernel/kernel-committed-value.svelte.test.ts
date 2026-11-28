// CommittedValue: a memory that holds its initial value, commits the step it follows after each
// update, and takes a direct commit.
import { flushSync } from "svelte";
import { describe, expect, it } from "vitest";

import { CommittedValue } from "../../../src/foundation/kernel/index.js";
import { root } from "../../kit/kit-effects.svelte.js";

/** A step counted from the memory: how often the source moved since the memory last settled. */
function setup() {
	const source = $state({ value: 0 });
	const memory = new CommittedValue({ initial: { value: 0, moves: 0 } });
	// A step returns the memory itself while nothing moved, so committing it is a fixed point.
	const step = $derived(
		source.value === memory.current.value
			? memory.current
			: { value: source.value, moves: memory.current.moves + 1 },
	);
	root(() => memory.follow(() => step));
	return { source, memory, read: () => step };
}

describe("CommittedValue", () => {
	it("holds its initial value until it follows a step", () => {
		const memory = new CommittedValue({ initial: "start" });
		expect(memory.current).toBe("start");
	});

	it("commits the step on mount, then after each update that changes it", () => {
		const { source, memory, read } = setup();
		flushSync();
		expect(memory.current).toEqual({ value: 0, moves: 0 });

		source.value = 1;
		expect(read()).toEqual({ value: 1, moves: 1 });
		flushSync();
		expect(memory.current).toEqual({ value: 1, moves: 1 });
		// Committed, the step reads as the memory: no new move is counted.
		expect(read()).toBe(memory.current);

		source.value = 2;
		flushSync();
		expect(memory.current).toEqual({ value: 2, moves: 2 });
	});

	it("takes a direct commit, which the next step counts from", () => {
		const { source, memory, read } = setup();
		flushSync();
		memory.commit({ value: 0, moves: 10 });
		expect(read()).toEqual({ value: 0, moves: 10 });
		source.value = 5;
		flushSync();
		expect(memory.current).toEqual({ value: 5, moves: 11 });
	});
});
