import { flushSync } from "svelte";
import { afterEach, describe, expect, it } from "vitest";

import { CommittedValue } from "../../../src/foundation/kernel/index.js";

const roots: (() => void)[] = [];

afterEach(() => {
	roots.splice(0).forEach((cleanup) => cleanup());
});

/** A step counted from the memory: how often the source moved since the memory last settled. */
function setup() {
	const source = $state({ value: 0 });
	const memory = new CommittedValue({ value: 0, moves: 0 });
	// A step returns the memory itself while nothing moved, so committing it is a fixed point.
	const step = $derived(
		source.value === memory.current.value
			? memory.current
			: { value: source.value, moves: memory.current.moves + 1 },
	);
	roots.push($effect.root(() => memory.follow(() => step)));
	return { source, memory, read: () => step };
}

describe("CommittedValue", () => {
	it("holds its initial value until it follows a step", () => {
		const memory = new CommittedValue("start");
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
