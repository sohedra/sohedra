// bound: the pair a part makes for a `$bindable` prop, read through its getter and written through
// its setter.
import { describe, expect, it, vi } from "vitest";

import { bound } from "../../../src/foundation/kernel/index.js";

describe("bound", () => {
	it("reads through the getter and writes through the setter", () => {
		let parent = 1;
		const set = vi.fn((next: number) => {
			parent = next;
		});
		const binding = bound(() => parent, set);
		expect(binding.value).toBe(1);

		binding.value = 2;
		expect(set).toHaveBeenCalledExactlyOnceWith(2);
		expect(binding.value).toBe(2);
	});

	it("reads the getter again on each read, so a declined write reads back the old value", () => {
		const set = vi.fn();
		const binding = bound(() => "kept", set);
		binding.value = "next";
		expect(set).toHaveBeenCalledExactlyOnceWith("next");
		expect(binding.value).toBe("kept");
	});
});
