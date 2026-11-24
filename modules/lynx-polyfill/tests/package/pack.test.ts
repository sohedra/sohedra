// The package as it is published: built, packed by pnpm (which puts `publishConfig.exports` in
// place of `exports`) from a copy of this folder, unpacked, and read. What it holds, whether every
// entry is there, and what publint says of it.

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "@rstest/core";
import { publint } from "publint";
import { formatMessage } from "publint/utils";

const ROOT = path.resolve(import.meta.dirname, "../..");
/** What is not the package's to pack: installed, built, cached, or written by a test run. */
const NOT_COPIED = new Set(["node_modules", "lib", "coverage", ".cache", ".swc", "dist"]);

interface Manifest {
	exports: Record<string, unknown>;
	sideEffects: string[];
}

let work: string;
let unpacked: string;
let files: string[];
let manifest: Manifest;

beforeAll(() => {
	work = fs.mkdtempSync(path.join(os.tmpdir(), "sohedra-lynx-polyfill-pack-"));
	const copy = path.join(work, "package");
	fs.cpSync(ROOT, copy, {
		recursive: true,
		filter: (from) => !NOT_COPIED.has(path.relative(ROOT, from).split(path.sep)[0]!),
	});
	fs.symlinkSync(path.join(ROOT, "node_modules"), path.join(copy, "node_modules"), "dir");
	execFileSync("pnpm", ["run", "build"], { cwd: copy, stdio: "pipe" });
	execFileSync("pnpm", ["pack", "--pack-destination", work], { cwd: copy, stdio: "pipe" });
	const tarball = fs.readdirSync(work).find((name) => name.endsWith(".tgz"))!;
	unpacked = path.join(work, "unpacked");
	fs.mkdirSync(unpacked);
	// Names relative to `work`: GNU tar, which Windows' Git puts first on the path, reads `D:\…` as
	// a remote host.
	execFileSync("tar", ["-xzf", tarball, "-C", "unpacked"], { cwd: work });
	unpacked = path.join(unpacked, "package");
	files = fs
		.readdirSync(unpacked, { recursive: true, encoding: "utf8" })
		.filter((file) => fs.statSync(path.join(unpacked, file)).isFile())
		.map((file) => file.split(path.sep).join("/"));
	manifest = JSON.parse(fs.readFileSync(path.join(unpacked, "package.json"), "utf8")) as Manifest;
}, 120_000);
afterAll(() => fs.rmSync(work, { recursive: true, force: true }));

/** Every path an `exports` value names, through its conditions. */
function targets(value: unknown): string[] {
	if (typeof value === "string") return [value];
	if (value && typeof value === "object") return Object.values(value).flatMap(targets);
	return [];
}

describe("the packed package", () => {
	it("holds the built files, the types, the notices and the manifest, and nothing else", () => {
		const tops = [...new Set(files.map((file) => file.split("/")[0]!))].toSorted();
		expect(tops).toEqual(["LICENSE", "NOTICE", "README.md", "lib", "package.json", "types"]);
	});

	it("exports the built files, each of which it holds", () => {
		const named = Object.values(manifest.exports).flatMap(targets);
		expect(
			named.filter(
				(target) =>
					!target.startsWith("./lib/") &&
					!target.startsWith("./types/") &&
					target !== "./package.json",
			),
		).toEqual([]);
		expect(named.filter((target) => !files.includes(target.slice(2)))).toEqual([]);
	});

	it("holds the vendored modules the built fills import", () => {
		const vendored = fs.readdirSync(path.join(ROOT, "src/fills/vendor"));
		expect(vendored.filter((file) => !files.includes(`lib/fills/vendor/${file}`))).toEqual([]);
	});

	it("marks every entry as acting on load, so an app's build keeps it", () => {
		for (const pattern of manifest.sideEffects.filter((pattern) => pattern.startsWith("./lib/"))) {
			const folder = pattern.replace(/\/\*\.js$/, "").slice(2);
			expect(
				files.some((file) => file.startsWith(`${folder}/`)),
				pattern,
			).toBe(true);
		}
	});

	it("passes publint", async () => {
		const { messages, pkg } = await publint({ pkgDir: unpacked, pack: false, level: "suggestion" });
		expect(messages.map((message) => formatMessage(message, pkg))).toEqual([]);
	});
});
