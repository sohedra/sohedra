// Which build config an app has, for what reads it outside a build.

import path from "node:path";

import { describe, expect, it } from "@rstest/core";

import { configLoader, findConfigFile } from "../../../../src/build/presets/config-file.ts";

const configs = path.resolve(import.meta.dirname, "../../../fixtures/build/configs");

describe("findConfigFile", () => {
	it("takes lynx.config.* before rsbuild.config.* when an app has both", () => {
		expect(findConfigFile(path.join(configs, "both-configs"))).toBe(
			path.join(configs, "both-configs", "lynx.config.ts"),
		);
	});

	it("takes rsbuild.config.* when it is the only one", () => {
		expect(findConfigFile(path.join(configs, "rsbuild-only"))).toBe(
			path.join(configs, "rsbuild-only", "rsbuild.config.ts"),
		);
	});

	it("is none for a folder without one", () => {
		expect(findConfigFile(configs)).toBeUndefined();
	});
});

describe("configLoader", () => {
	it("is rspeedy for lynx.config.* of any extension, and Rsbuild for the rest", () => {
		for (const name of [
			"lynx.config.ts",
			"lynx.config.mjs",
			"lynx.config.cts",
			"/a/b/lynx.config.js",
		])
			expect(configLoader(name)).toBe("rspeedy");
		for (const name of ["rsbuild.config.ts", "my-lynx.config.ts", "lynx.config.json"])
			expect(configLoader(name)).toBe("rsbuild");
	});
});
