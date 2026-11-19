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
import ts from "typescript";

const ROOT = path.resolve(import.meta.dirname, "../../..");
/** What is not the package's to pack: installed, built, or written by a test run. */
const NOT_COPIED = new Set([
	"node_modules",
	"lib",
	"coverage",
	".types-consumer",
	".vitest",
	".swc",
]);

interface Manifest {
	exports: Record<string, unknown>;
	sideEffects: string[];
}

let work: string;
let unpacked: string;
let files: string[];
let manifest: Manifest;

/** Build the copy's `lib/` as `pnpm build` does. */
function build(folder: string): void {
	const config = ts.getParsedCommandLineOfConfigFile(
		path.join(folder, "tsconfig.build.json"),
		{},
		{
			...ts.sys,
			onUnRecoverableConfigFileDiagnostic: (diagnostic) => {
				throw new Error(ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"));
			},
		},
	)!;
	const emitted = ts.createProgram({ rootNames: config.fileNames, options: config.options }).emit();
	expect(
		emitted.diagnostics.map((d) => ts.flattenDiagnosticMessageText(d.messageText, "\n")),
	).toEqual([]);
}

beforeAll(() => {
	work = fs.mkdtempSync(path.join(os.tmpdir(), "sohedra-lynx-pack-"));
	const copy = path.join(work, "package");
	fs.cpSync(ROOT, copy, {
		recursive: true,
		filter: (from) => !NOT_COPIED.has(path.relative(ROOT, from).split(path.sep)[0]!),
	});
	build(copy);
	execFileSync("pnpm", ["pack", "--pack-destination", work], { cwd: copy, stdio: "pipe" });
	const tarball = fs.readdirSync(work).find((name) => name.endsWith(".tgz"))!;
	unpacked = path.join(work, "unpacked");
	fs.mkdirSync(unpacked);
	execFileSync("tar", ["-xzf", path.join(work, tarball), "-C", unpacked]);
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
			named.filter((target) => !target.startsWith("./lib/") && !target.startsWith("./types/")),
		).toEqual([]);
		expect(named.filter((target) => !files.includes(target.slice(2)))).toEqual([]);
	});

	it("holds the built files its sideEffects name", () => {
		// The source's patterns stay too: pnpm's publishConfig cannot replace sideEffects.
		for (const pattern of manifest.sideEffects.filter((pattern) => pattern.startsWith("./lib/"))) {
			const base = pattern.replace(/\/\*\*$/, "").slice(2);
			expect(
				files.some((file) => file === base || file.startsWith(`${base}/`)),
				pattern,
			).toBe(true);
		}
	});

	it("carries the sources in its source maps, which name files it does not hold", () => {
		const maps = files.filter((file) => file.endsWith(".js.map"));
		expect(maps.length).toBeGreaterThan(0);
		const missing = maps.filter((file) => {
			const map = JSON.parse(fs.readFileSync(path.join(unpacked, file), "utf8")) as {
				sources: string[];
				sourcesContent?: (string | null)[];
			};
			return map.sources.some((_, index) => typeof map.sourcesContent?.[index] !== "string");
		});
		expect(missing).toEqual([]);
	});

	it("passes publint", async () => {
		const { messages, pkg } = await publint({ pkgDir: unpacked, pack: false, level: "suggestion" });
		expect(messages.map((message) => formatMessage(message, pkg))).toEqual([]);
	});
});
