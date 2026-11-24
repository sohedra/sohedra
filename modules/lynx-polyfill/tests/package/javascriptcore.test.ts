// "Never replaces a built-in that works", on JavaScriptCore: a production iOS app runs the
// background thread on it, and it has most of what PrimJS lacks. Each import of the package, as an
// app's build bundles it for each thread (entry-script.ts), runs in JavaScriptCore's shell after a
// script that keeps every global and every property of the built-ins the fills touch; a script
// after it lists each that is no longer the same object. Adding what the engine lacks is the fills'
// job. Runs where the shell is: macOS (the system's JavaScriptCore framework).

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterAll, describe, expect, it } from "@rstest/core";

import type { Thread } from "../../src/fills/globals.ts";
import { bundleEntry, PACKAGE_NAME, subpaths } from "./entry-script.ts";

const JSC = "/System/Library/Frameworks/JavaScriptCore.framework/Versions/Current/Helpers/jsc";
const HAS_JSC = fs.existsSync(JSC);

/** What a Lynx thread gives its scripts, then every property the fills could replace, kept. */
const BEFORE = `
globalThis.lynx = { reportError: function (error) { print("reported: " + error); }, queueMicrotask: function (run) { Promise.resolve().then(run); } };
globalThis.SystemInfo = { platform: "iOS", engineVersion: "4.2" };
globalThis.console = { log: function () {}, warn: function () {}, error: function () {} };
// The timers Lynx passes the background's bundle, which the shell has only in part.
if (typeof clearTimeout !== "function") {
	globalThis.clearTimeout = function () {};
	globalThis.setInterval = function () { return 0; };
	globalThis.clearInterval = function () {};
}
(function () {
var targets = {
	globalThis: globalThis, Object: Object, Array: Array, "Array.prototype": Array.prototype,
	"%TypedArray%.prototype": Object.getPrototypeOf(Int8Array.prototype), String: String,
	"String.prototype": String.prototype, Promise: Promise, Reflect: Reflect, RegExp: RegExp,
	Map: Map, "Set.prototype": Set.prototype, Math: Math, "DataView.prototype": DataView.prototype,
	BigInt: BigInt, JSON: JSON, Error: Error,
};
globalThis.__kept = [];
for (var owner in targets) {
	var target = targets[owner];
	Reflect.ownKeys(target).forEach(function (key) {
		var d = Object.getOwnPropertyDescriptor(target, key);
		__kept.push([owner, key, target, d.value, d.get, d.set]);
	});
}
})();
`;

/** Lists each kept property that is no longer the same object. */
const AFTER = `
(function () {
var replaced = [];
__kept.forEach(function (row) {
	var d = Object.getOwnPropertyDescriptor(row[2], row[1]);
	if (row[0] === "globalThis" && row[1] === "__kept") return;
	if (!d || !Object.is(d.value, row[3]) || d.get !== row[4] || d.set !== row[5])
		replaced.push(row[0] + "." + String(row[1]));
});
print("replaced: " + JSON.stringify(replaced));
})();
`;

const work = fs.mkdtempSync(path.join(os.tmpdir(), "sohedra-jsc-"));
afterAll(() => fs.rmSync(work, { recursive: true, force: true }));

describe.runIf(HAS_JSC)("on JavaScriptCore", () => {
	describe.each(subpaths())(`import "${PACKAGE_NAME}%s"`, (subpath) => {
		it.each(["background", "main-thread"] as Thread[])(
			"on the %s replaces no built-in",
			async (thread) => {
				const code = await bundleEntry({ subpath, thread, minimize: false });
				const name = `${thread}${subpath.replaceAll("/", "-")}`;
				const files = [`${name}-before.js`, `${name}.js`, `${name}-after.js`];
				fs.writeFileSync(path.join(work, files[0]!), BEFORE);
				fs.writeFileSync(path.join(work, files[1]!), code);
				fs.writeFileSync(path.join(work, files[2]!), AFTER);
				const output = execFileSync(JSC, files, { cwd: work, encoding: "utf8" });
				expect(output.trim().split("\n")).toEqual(["replaced: []"]);
			},
			60_000,
		);
	});
});
