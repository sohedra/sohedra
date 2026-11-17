// The template plugin of the Lynx build engine and the package's own must be one version.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterAll, describe, expect, it } from "@rstest/core";

import {
	checkTemplatePlugin,
	engineTemplateVersion,
	ownTemplateVersion,
} from "../../../../src/build/plugin/template-plugin.ts";

const made: string[] = [];
afterAll(() => {
	for (const folder of made) fs.rmSync(folder, { recursive: true, force: true });
});

/** A folder with a template plugin of `version` installed beside the engine plugin. */
function engineWith(version: string | undefined): string {
	const folder = fs.mkdtempSync(path.join(os.tmpdir(), "sohedra-lynx-engine-"));
	made.push(folder);
	if (version !== undefined) {
		const plugin = path.join(folder, "node_modules", "@lynx-js", "template-webpack-plugin");
		fs.mkdirSync(plugin, { recursive: true });
		fs.writeFileSync(
			path.join(plugin, "package.json"),
			JSON.stringify({ name: "@lynx-js/template-webpack-plugin", version }),
		);
	}
	fs.writeFileSync(path.join(folder, "package.json"), "{}");
	return folder;
}

describe("the engine's template plugin", () => {
	it("is read from the version installed beside the engine's plugin", () => {
		expect(engineTemplateVersion(engineWith("0.16.9"))).toBe("0.16.9");
	});

	it("is unknown when none is installed there", () => {
		expect(engineTemplateVersion(engineWith(undefined))).toBeUndefined();
	});

	it("has the package's own version, which package.json states", () => {
		expect(ownTemplateVersion()).toMatch(/^\d+\.\d+\.\d+$/);
	});
});

describe("checkTemplatePlugin", () => {
	it("accepts the same version, also as two copies", () => {
		expect(() => checkTemplatePlugin({ engine: "0.16.8", own: "0.16.8" })).not.toThrow();
	});

	it("refuses another version, naming both", () => {
		expect(() => checkTemplatePlugin({ engine: "0.16.9", own: "0.16.8" })).toThrow(
			"The Lynx build engine uses @lynx-js/template-webpack-plugin 0.16.9, and @sohedra/lynx uses 0.16.8.",
		);
	});

	it("refuses a patch apart too: the plugin's hooks and options change in every release", () => {
		expect(() => checkTemplatePlugin({ engine: "0.16.8", own: "0.16.9" })).toThrow(
			expect.objectContaining({ code: "template_plugin_versions" }),
		);
	});
});
