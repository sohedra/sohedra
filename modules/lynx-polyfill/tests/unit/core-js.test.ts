// How the language fills load core-js's modules: a module only where its method is missing, and in
// place of a built-in only where the fill's own check finds it wrong.

import { afterEach, describe, expect, it, rs } from "@rstest/core";

import { fillFromCoreJs, replaceFromCoreJs } from "../../src/fills/language/core-js.ts";
import { forceCoreJs, loadCoreJs } from "../../src/fills/vendor/core-js.js";

rs.mock("../../src/fills/vendor/core-js.js", { spy: true });
afterEach(() => {
	rs.clearAllMocks();
});

describe("a fill from core-js", () => {
	it("loads the module of each method its object lacks, and only those", () => {
		fillFromCoreJs([
			["es.array.at", { at: () => {} }, "at"],
			["es.object.has-own", {}, "hasOwn"],
			["es.regexp.escape", { escape: undefined }, "escape"],
		]);
		expect(rs.mocked(loadCoreJs).mock.calls).toEqual([["es.object.has-own"], ["es.regexp.escape"]]);
	});

	it("loads none where the engine has them all", () => {
		fillFromCoreJs([["es.object.has-own", Object, "hasOwn"]]);
		expect(loadCoreJs).not.toHaveBeenCalled();
	});
});

describe("a replacement from core-js", () => {
	it("forces core-js's own and loads it where the fill's check fails", () => {
		replaceFromCoreJs("es.reflect.apply", "Reflect.apply", false);
		expect(rs.mocked(forceCoreJs).mock.calls).toEqual([["Reflect.apply"]]);
		expect(rs.mocked(loadCoreJs).mock.calls).toEqual([["es.reflect.apply"]]);
		expect(rs.mocked(forceCoreJs)).toHaveBeenCalledBefore(rs.mocked(loadCoreJs));
	});

	it("does nothing where the check holds", () => {
		replaceFromCoreJs("es.object.assign", "Object.assign", true);
		expect(forceCoreJs).not.toHaveBeenCalled();
		expect(loadCoreJs).not.toHaveBeenCalled();
	});
});
