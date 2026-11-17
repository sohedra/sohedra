// `__LoadStyleSheet` and `__AdoptStyleSheet`: a lazy bundle's CSS, found by its bundle's name.

import { describe, expect, it } from "@rstest/core";

import { engineForEach } from "./engine-fixture.ts";

const engine = engineForEach();

describe("style sheets", () => {
	it("loads the sheet of a bundle the test provided, and answers undefined for any other", () => {
		const sheet = { rules: "a{}" };
		engine().provideStyleSheet("lazy-a", sheet);
		const f = engine().functions;
		expect(f.__LoadStyleSheet("CSS", "lazy-a")).toBe(sheet);
		expect(f.__LoadStyleSheet("CSS", "lazy-b")).toBeUndefined();
	});

	it("adopts a sheet it loaded, and ignores one it did not", () => {
		const sheet = { rules: "a{}" };
		engine().provideStyleSheet("lazy-a", sheet);
		const f = engine().functions;
		f.__AdoptStyleSheet({ rules: "other" });
		expect(engine().adoptedStyleSheets).toEqual([]);
		f.__AdoptStyleSheet(f.__LoadStyleSheet("CSS", "lazy-a"));
		expect(engine().adoptedStyleSheets).toEqual([sheet]);
	});

	it("refuses a section or a bundle name that is not text", () => {
		const f = engine().functions;
		expect(() => f.__LoadStyleSheet(1 as never, "a")).toThrow(
			"__LoadStyleSheet param 0 should be text",
		);
		expect(() => f.__LoadStyleSheet("CSS", undefined as never)).toThrow(
			"__LoadStyleSheet param 1 should be text",
		);
	});
});
