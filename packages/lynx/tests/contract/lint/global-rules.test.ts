// Which globals each folder's code may name. A thread's globals are reached through the typed
// `globals.ts` of its folder, so lint refuses them anywhere else.

import { describe, expect, it } from "@rstest/core";

import { lint, reported } from "./lint-fixture.ts";

const SRC = "packages/lynx/src";

/** The folders that run on Node. */
const NODE_FOLDERS = ["build", "svelte/build", "testing"];
/** The folders that run on a Lynx thread, or on both. */
const THREAD_FOLDERS = [
	"wire",
	"background",
	"main-thread",
	"first-frame",
	"svelte/runtime",
	"gesture",
	"env",
];

const NAMES = {
	process: 'export const value = process.env["A"];\n',
	setTimeout: "export const value = setTimeout(() => {}, 1);\n",
	document: "export const value = document.title;\n",
	lynx: "export const value = lynx.reportError;\n",
	__FlushElementTree: "export const value = __FlushElementTree;\n",
};

describe("globals by folder", () => {
	const files: Record<string, string> = {};
	for (const folder of [...NODE_FOLDERS, ...THREAD_FOLDERS]) {
		for (const [name, source] of Object.entries(NAMES)) {
			files[`${SRC}/${folder}/probe-${name}.ts`] = source;
		}
		files[`${SRC}/${folder}/probe-global-this.ts`] = "export const value = globalThis;\n";
		files[`${SRC}/${folder}/probe-reflect.ts`] = 'export const value = Reflect.get({}, "a");\n';
		files[`${SRC}/${folder}/globals.ts`] = "export const value = globalThis;\n";
	}
	const problems = lint(files);
	const undefinedNames = reported(problems, "eslint(no-undef)");
	const restricted = reported(problems, "eslint(no-restricted-globals)");

	for (const folder of NODE_FOLDERS) {
		it(`${folder} may name Node's globals, and no thread's`, () => {
			expect(undefinedNames.has(`${SRC}/${folder}/probe-process.ts`)).toBe(false);
			expect(undefinedNames.has(`${SRC}/${folder}/probe-setTimeout.ts`)).toBe(false);
			expect(undefinedNames.has(`${SRC}/${folder}/probe-lynx.ts`)).toBe(true);
			expect(undefinedNames.has(`${SRC}/${folder}/probe-__FlushElementTree.ts`)).toBe(true);
		});
	}

	for (const folder of THREAD_FOLDERS) {
		it(`${folder} may name neither Node's globals nor a thread's`, () => {
			for (const name of Object.keys(NAMES)) {
				expect(undefinedNames.has(`${SRC}/${folder}/probe-${name}.ts`), name).toBe(true);
			}
		});
	}

	for (const folder of [...NODE_FOLDERS, ...THREAD_FOLDERS]) {
		it(`${folder} may write globalThis only in its globals.ts`, () => {
			expect(restricted.has(`${SRC}/${folder}/probe-global-this.ts`)).toBe(true);
			expect(restricted.has(`${SRC}/${folder}/globals.ts`)).toBe(false);
		});
	}

	// The engine's objects refuse `Reflect.get` on Android: code that runs on the main thread reads
	// properties plainly.
	for (const folder of ["main-thread", "first-frame", "wire", "gesture"]) {
		it(`${folder} may not use Reflect`, () => {
			expect(restricted.has(`${SRC}/${folder}/probe-reflect.ts`)).toBe(true);
		});
	}

	it("lets the background use Reflect, which never meets the main thread's engine objects", () => {
		expect(restricted.has(`${SRC}/background/probe-reflect.ts`)).toBe(false);
	});

	it("refuses the DOM everywhere", () => {
		for (const folder of NODE_FOLDERS) {
			expect(undefinedNames.has(`${SRC}/${folder}/probe-document.ts`), folder).toBe(true);
		}
	});
});

describe("console in the threads' code", () => {
	// On the main thread `console.error` is a Lynx error report of its own (PrimJS reports it with
	// the main thread's code), so an error the binding reports and logs would show twice in LogBox.
	const folders = ["main-thread", "first-frame", "gesture", "wire", "svelte/runtime", "env"];
	const files: Record<string, string> = {};
	for (const folder of folders)
		files[`${SRC}/${folder}/probe-console.ts`] =
			'export function log(): void {\n\tconsole.error("a");\n}\n';
	const consoles = reported(lint(files), "eslint(no-console)");

	it.each(folders)("%s may not call console.error", (folder) => {
		expect(consoles.has(`${SRC}/${folder}/probe-console.ts`)).toBe(true);
	});
});
