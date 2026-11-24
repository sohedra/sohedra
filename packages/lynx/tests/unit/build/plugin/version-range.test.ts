// Whether a version is in a range of a package.json: the forms this package's own ranges take.

import { describe, expect, it } from "@rstest/core";

import { satisfiesRange } from "../../../../src/build/plugin/version-range.ts";

describe("satisfiesRange, a caret range", () => {
	it("takes a version of the same minor at or above the floor, for a 0.x range", () => {
		expect(satisfiesRange("0.16.8", "^0.16.8")).toBe(true);
		expect(satisfiesRange("0.16.9", "^0.16.8")).toBe(true);
		expect(satisfiesRange("0.16.20", "^0.16.8")).toBe(true);
	});

	it("refuses a 0.x version of another minor, or below the floor", () => {
		for (const version of ["0.15.9", "0.16.7", "0.17.0", "1.0.0"])
			expect(satisfiesRange(version, "^0.16.8"), version).toBe(false);
	});

	it("takes any later minor and patch of the same major, for a range from 1.0", () => {
		expect(satisfiesRange("2.3.1", "^2.1.0")).toBe(true);
		expect(satisfiesRange("2.1.0", "^2.1.0")).toBe(true);
		expect(satisfiesRange("2.0.9", "^2.1.0")).toBe(false);
		expect(satisfiesRange("3.0.0", "^2.1.0")).toBe(false);
	});

	it("refuses a prerelease of the range's floor or above: only released versions are meant", () => {
		expect(satisfiesRange("0.16.9-beta.1", "^0.16.8")).toBe(false);
	});
});

describe("satisfiesRange, a tilde range", () => {
	it("takes a patch of the same minor at or above the floor", () => {
		expect(satisfiesRange("5.59.0", "~5.59.0")).toBe(true);
		expect(satisfiesRange("5.59.14", "~5.59.0")).toBe(true);
		expect(satisfiesRange("5.59.3", "~5.59.2")).toBe(true);
	});

	it("refuses a version just outside either end", () => {
		for (const version of ["5.58.9", "5.59.1", "5.60.0", "6.59.0", "4.59.0"])
			expect(satisfiesRange(version, "~5.59.2"), version).toBe(false);
	});

	it("refuses a prerelease, even of a version in the range", () => {
		for (const version of ["5.59.1-next.0", "5.60.0-next.1", "5.59.0-rc"])
			expect(satisfiesRange(version, "~5.59.0"), version).toBe(false);
	});
});

describe("satisfiesRange, other forms", () => {
	it("takes a version in any range of `||`", () => {
		expect(satisfiesRange("5.59.2", "~5.59.0 || ~5.60.0")).toBe(true);
		expect(satisfiesRange("5.60.1", "~5.59.0 || ~5.60.0")).toBe(true);
		expect(satisfiesRange("5.61.0", "~5.59.0 || ~5.60.0")).toBe(false);
		expect(satisfiesRange("5.58.9", "~5.59.0 || ~5.60.0")).toBe(false);
	});

	it("takes only the version itself for an exact one", () => {
		expect(satisfiesRange("0.0.53", "0.0.53")).toBe(true);
		expect(satisfiesRange("0.0.54", "0.0.53")).toBe(false);
	});

	it("matches nothing for a form it does not read, or a version that is not one", () => {
		expect(satisfiesRange("5.59.0", ">=5.59.0")).toBe(false);
		expect(satisfiesRange("5.59.0", "5.x")).toBe(false);
		expect(satisfiesRange("latest", "~5.59.0")).toBe(false);
	});
});
