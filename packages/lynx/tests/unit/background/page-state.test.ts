// What the background keeps of its page, the generation; and how its reload and destroy run steps.

import { describe, expect, it } from "@rstest/core";

import {
	bumpGeneration,
	currentGeneration,
	runAll,
	startGeneration,
} from "../../../src/background/page-state.ts";

describe("the page's generation", () => {
	it("starts at 0, and is bumped by one each time", () => {
		startGeneration();
		expect(currentGeneration()).toBe(0);
		bumpGeneration();
		bumpGeneration();
		expect(currentGeneration()).toBe(2);
		startGeneration();
		expect(currentGeneration()).toBe(0);
	});
});

describe("runAll", () => {
	it("runs every step, in order, though one throws, and throws the first error", () => {
		const ran: string[] = [];
		const steps = [
			() => ran.push("a"),
			() => {
				ran.push("b");
				throw new Error("first");
			},
			() => {
				ran.push("c");
				throw new Error("second");
			},
		];
		expect(() => runAll(steps)).toThrow("first");
		expect(ran).toEqual(["a", "b", "c"]);
	});

	it("runs every step and throws nothing when none throws", () => {
		const ran: number[] = [];
		runAll([() => ran.push(1), () => ran.push(2)]);
		expect(ran).toEqual([1, 2]);
	});
});
