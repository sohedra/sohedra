import { describe, expect, it } from "vitest";

import { Controllable, type ControllableSource } from "../../../src/foundation/kernel/index.js";

const options = { default: () => "", name: "Test", state: "value" };

describe("Controllable.assign", () => {
	it("writes through to the source without a change callback", () => {
		let parent = $state<string | undefined>(undefined);
		const source: ControllableSource<string> = {
			get value() {
				return parent;
			},
			set value(next) {
				parent = next;
			},
		};
		const value = new Controllable(source, options);
		expect(value.assign("typed")).toBe(true);
		expect(source.value).toBe("typed");
		expect(value.current).toBe("typed");
		// The local value holds it too, should the parent stop controlling.
		parent = undefined;
		expect(value.current).toBe("typed");
	});

	it("reports a declined write and keeps it out of the local value", () => {
		let parent = $state<string | undefined>("bound");
		const source: ControllableSource<string> = {
			get value() {
				return parent;
			},
			set value(_next) {
				// A function binding that declines every write.
			},
		};
		const value = new Controllable(source, options);
		expect(value.assign("typed")).toBe(false);
		expect(value.current).toBe("bound");
		// The local value is still the initial one, not the declined value.
		parent = undefined;
		expect(value.current).toBe("bound");
	});
});
