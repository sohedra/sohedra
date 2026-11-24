// What the background keeps of its page: the generation, and what is let go of at the end.

import { describe, expect, it } from "@rstest/core";

import {
	bumpGeneration,
	clearPageState,
	currentGeneration,
	onPageDestroy,
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

describe("clearPageState", () => {
	it("runs every clear, in order, though one throws, and throws the first error", () => {
		const ran: string[] = [];
		onPageDestroy(() => ran.push("a"));
		onPageDestroy(() => {
			ran.push("b");
			throw new Error("first");
		});
		onPageDestroy(() => {
			ran.push("c");
			throw new Error("second");
		});
		expect(() => clearPageState()).toThrow("first");
		expect(ran).toEqual(["a", "b", "c"]);
	});

	it("runs a clear once: the next page starts with none", () => {
		const ran: string[] = [];
		onPageDestroy(() => ran.push("once"));
		clearPageState();
		clearPageState();
		expect(ran).toEqual(["once"]);
	});
});

describe("runAll", () => {
	it("runs every step and throws nothing when none throws", () => {
		const ran: number[] = [];
		runAll([() => ran.push(1), () => ran.push(2)]);
		expect(ran).toEqual([1, 2]);
	});
});
