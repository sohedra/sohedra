// The template plugin Lynx's build plugin runs with must be one this package works with: the
// versions the range in its package.json allows.

import fs from "node:fs";
import { Module } from "node:module";
import os from "node:os";
import path from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "@rstest/core";

import {
	checkTemplatePlugin,
	engineFolder,
	ownTemplateRange,
	ownTemplateVersion,
	templateVersionOf,
} from "../../../../src/build/plugin/template-plugin.ts";
import { satisfiesRange } from "../../../../src/build/plugin/version-range.ts";

const made: string[] = [];

// A package manager sets NODE_PATH for its scripts, and Node always looks there last, so a tree
// here would find the repository's own packages where it has none. These tests need the tree
// alone.
// Boundary: Node's private `_initPaths` reads NODE_PATH again; no public call does.
const nodeModule = Module as unknown as { _initPaths(): void };
const nodePath = process.env["NODE_PATH"];
beforeAll(() => {
	delete process.env["NODE_PATH"];
	nodeModule._initPaths();
});
afterAll(() => {
	if (nodePath !== undefined) process.env["NODE_PATH"] = nodePath;
	nodeModule._initPaths();
	for (const folder of made) fs.rmSync(folder, { recursive: true, force: true });
});

const PLUGIN = "@lynx-js/template-webpack-plugin";
const ENGINE = "@lynx-js/rsbuild-plugin";

/** A folder in which `files` (package name to version) are packages, each under its parent's `node_modules`. */
function tree(packages: Record<string, string>): string {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), "sohedra-lynx-engine-"));
	made.push(root);
	fs.writeFileSync(path.join(root, "package.json"), "{}");
	for (const [where, version] of Object.entries(packages)) {
		const folder = path.join(root, where);
		fs.mkdirSync(folder, { recursive: true });
		const name = where.split("node_modules/").at(-1)!.replace(/\/$/, "");
		fs.writeFileSync(path.join(folder, "package.json"), JSON.stringify({ name, version }));
	}
	return root;
}

describe("this package's own template plugin", () => {
	it("has the version installed, and the range its package.json states", () => {
		expect(ownTemplateVersion()).toMatch(/^\d+\.\d+\.\d+$/);
		expect(ownTemplateRange()).toMatch(/^\^\d+\.\d+\.\d+$/);
		expect(satisfiesRange(ownTemplateVersion(), ownTemplateRange())).toBe(true);
	});
});

describe("templateVersionOf", () => {
	it("is the version of the template plugin installed for the engine's folder", () => {
		const root = tree({
			[`node_modules/${ENGINE}`]: "0.1.9",
			[`node_modules/${ENGINE}/node_modules/${PLUGIN}`]: "0.16.9",
		});
		expect(templateVersionOf(path.join(root, "node_modules", ENGINE))).toBe("0.16.9");
	});

	it("is the one found above, as a package manager that hoists lays it out", () => {
		const root = tree({
			[`node_modules/${ENGINE}`]: "0.1.9",
			[`node_modules/${PLUGIN}`]: "0.15.2",
		});
		expect(templateVersionOf(path.join(root, "node_modules", ENGINE))).toBe("0.15.2");
	});

	it("is unknown when none is installed for it", () => {
		const root = tree({ [`node_modules/${ENGINE}`]: "0.1.9" });
		expect(templateVersionOf(path.join(root, "node_modules", ENGINE))).toBeUndefined();
	});
});

describe("engineFolder", () => {
	it("is this package's own copy of the engine's plugin when this package registered the engine", () => {
		const own = engineFolder({ registered: true, root: "/nowhere" });
		expect(own).toBeDefined();
		expect(path.basename(own!)).toBe("rsbuild-plugin");
	});

	it("is the app's own, when the app has the engine's plugin and did not leave it to this package", () => {
		const root = tree({ [`node_modules/${ENGINE}`]: "0.1.8" });
		expect(engineFolder({ registered: false, root })).toBe(
			fs.realpathSync(path.join(root, "node_modules", ENGINE)),
		);
	});

	it("is the one rspeedy brings, when the app has rspeedy and no engine plugin of its own", () => {
		const root = tree({
			"node_modules/@lynx-js/rspeedy": "0.18.6",
			[`node_modules/@lynx-js/rspeedy/node_modules/${ENGINE}`]: "0.1.7",
		});
		expect(engineFolder({ registered: false, root })).toBe(
			fs.realpathSync(path.join(root, "node_modules/@lynx-js/rspeedy/node_modules", ENGINE)),
		);
	});

	it("is unknown when the app has neither", () => {
		expect(engineFolder({ registered: false, root: tree({}) })).toBeUndefined();
	});
});

describe("checkTemplatePlugin", () => {
	const range = "^0.16.8";

	it("accepts the version this package has, and a patch or minor inside the range", () => {
		for (const engine of ["0.16.8", "0.16.9", "0.16.30"])
			expect(() => checkTemplatePlugin({ engine, own: "0.16.8", range }), engine).not.toThrow();
	});

	it("refuses a version outside the range, naming the engine's, this package's and the range", () => {
		expect(() => checkTemplatePlugin({ engine: "0.15.4", own: "0.16.8", range })).toThrow(
			"Lynx's build plugin uses @lynx-js/template-webpack-plugin 0.15.4, and @sohedra/lynx needs ^0.16.8 (it installs 0.16.8).",
		);
		expect(() => checkTemplatePlugin({ engine: "0.17.0", own: "0.16.8", range })).toThrow(
			expect.objectContaining({ code: "template_plugin_versions" }),
		);
	});
});
