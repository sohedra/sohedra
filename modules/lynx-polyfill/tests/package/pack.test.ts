// The package as it is published: built, packed by pnpm (which puts `publishConfig.exports` in
// place of `exports`) from a copy of this folder, unpacked, and read. What it holds, whether every
// entry is there, and what publint says of it.

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import vm from "node:vm";

import { afterAll, beforeAll, describe, expect, it } from "@rstest/core";
import { publint } from "publint";
import { formatMessage } from "publint/utils";
import ts from "typescript";

import type { Thread } from "../../src/fills/globals.ts";
import { bundleEntry, PACKAGE_NAME, subpaths, threadRealm } from "./entry-script.ts";

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

/** What a script adds to a thread's realm, and what it reports into Lynx. */
function installs(code: string, thread: Thread): { added: string[]; reports: unknown[] } {
	const { context, reports } = threadRealm(thread);
	const names = () =>
		vm.runInContext("Object.getOwnPropertyNames(globalThis)", context) as string[];
	const before = new Set(names());
	vm.runInContext(code, context);
	return {
		added: names()
			.filter((name) => !before.has(name))
			.sort(),
		reports,
	};
}

describe("the packed package's built files", () => {
	it.each(["background", "main-thread"] as const)(
		"install on the %s what the source does",
		async (thread) => {
			const packed = await bundleEntry({
				subpath: "",
				thread,
				minimize: true,
				packageRoot: unpacked,
			});
			const source = await bundleEntry({ subpath: "", thread, minimize: true });
			const fromPacked = installs(packed, thread);
			expect(fromPacked.reports).toEqual([]);
			expect(fromPacked.added.length).toBeGreaterThan(20);
			expect(fromPacked.added).toEqual(installs(source, thread).added);
		},
		120_000,
	);
});

describe("the types an app gets", () => {
	it(`check each import on TypeScript ${ts.versionMajorMinor}, with ES2025 and every declaration file`, () => {
		const app = path.join(work, "types-app");
		const linked = path.join(app, "node_modules", PACKAGE_NAME);
		fs.mkdirSync(path.dirname(linked), { recursive: true });
		fs.symlinkSync(unpacked, linked, "dir");
		const file = path.join(app, "index.ts");
		fs.writeFileSync(
			file,
			subpaths()
				.map((subpath) => `import "${PACKAGE_NAME}${subpath}";\n`)
				.join("") + "export const union: Set<number> = new Set([1]).union(new Set([2]));\n",
		);
		// The options of Sohedra's base config (`@sohedra/lynx/tsconfig`), with every declaration
		// file checked.
		const program = ts.createProgram({
			rootNames: [file],
			options: {
				target: ts.ScriptTarget.ES2025,
				lib: ["lib.es2025.d.ts"],
				module: ts.ModuleKind.ESNext,
				moduleResolution: ts.ModuleResolutionKind.Bundler,
				strict: true,
				isolatedModules: true,
				verbatimModuleSyntax: true,
				noEmit: true,
				skipLibCheck: false,
				types: [],
			},
		});
		const diagnostics = ts
			.getPreEmitDiagnostics(program)
			.map((diagnostic) => ts.flattenDiagnosticMessageText(diagnostic.messageText, " "));
		expect(diagnostics).toEqual([]);
		const entry = fs.realpathSync(path.join(unpacked, "types/entry.d.ts"));
		expect(program.getSourceFiles().some((source) => source.fileName === entry)).toBe(true);
	});
});
