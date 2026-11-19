import { describe, expect, it } from "@rstest/core";

import { floorOf } from "../../../scripts/floor.ts";

describe("the floor of a range", () => {
	it("is the version a caret range or an exact version starts from", () => {
		expect(floorOf("jsdom", "^31.0.1")).toBe("31.0.1");
		expect(floorOf("@lynx-js/tasm", "0.0.53")).toBe("0.0.53");
	});

	it("is the lowest of a range widened to a new major or 0.x minor", () => {
		expect(floorOf("jsdom", "^31.0.1 || ^32.0.0")).toBe("31.0.1");
		expect(floorOf("@rstest/core", "^0.12.6||^0.13.0")).toBe("0.12.6");
		expect(floorOf("vite", "^9.0.0 || ^8.3.8")).toBe("8.3.8");
	});

	it("is refused for a range it can't install at one version, naming the package", () => {
		for (const range of ["*", ">=28.0.0", "^31", "^31.0.1 || >=33.0.0", "^31.0.1 ||"]) {
			expect(() => floorOf("jsdom", range)).toThrow(/jsdom's range/);
		}
	});
});
