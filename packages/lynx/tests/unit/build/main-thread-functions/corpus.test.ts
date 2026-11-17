// A corpus for the main-thread function transform: small inputs, and what the build makes of
// each on both threads, kept as a snapshot. A change to what a function captures, to an id or to
// what is registered shows here.
//
// For each input and each thread, the snapshot has every main-thread function in the output (its
// id, the names it captured and the code of each captured value, how many background functions it
// holds) and the ids registered for the main thread's runtime. An input the build refuses has the first line of its error instead.
//
// tests/fixtures/build/main-thread-functions/
//   apps/        files of apps, scripts and components
//   runtime/     the shape of the binding's own main-thread function
//   reactlynx/   cases of ReactLynx's transform tests that the build needs, adapted (lynx-stack,
//                packages/react/transform/crates/swc_plugin_worklet/lib.rs; see NOTICE): the
//                names a body captures are declared in the file
//   rejected/    cases that are build errors (a class method, an object method, `this`)
//
// Two inputs of reactlynx/ capture less than ReactLynx's transform did, on purpose
// (NOT_CAPTURED). An id is a hash of the file's path under the app, a hash of its text, and a
// count: the corpus is compiled as a file of the test app, so the snapshot is the same on every
// machine. Editing an input changes its ids.

import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "@rstest/core";

import { compileScript, component } from "../compiling.ts";
import { readOutput } from "./output.ts";
import type { Output } from "./output.ts";

const corpus = path.resolve(import.meta.dirname, "../../../fixtures/build/main-thread-functions");

/** Names a body reads and the build leaves to the thread it runs on, per input. */
const NOT_CAPTURED: Record<string, { name: string; why: string }> = {
	"reactlynx/undeclared-name.js": {
		name: "myCustomGlobal",
		why: "no declaration in the file: a global, and the main thread has its own",
	},
	"reactlynx/skip-types.ts": {
		name: "wv",
		why: "`declare const` says the name exists elsewhere: a global, as above",
	},
};

function inputs(dir = corpus): string[] {
	return fs
		.readdirSync(dir, { withFileTypes: true })
		.flatMap((entry) => {
			const file = path.join(dir, entry.name);
			return entry.isDirectory() ? inputs(file) : [path.relative(corpus, file)];
		})
		.sort();
}

/** The functions and registrations of `name` compiled for one thread, or the first line of its error. */
async function form(
	source: string,
	thread: "background" | "main-thread",
	name: string,
): Promise<Output | { error: string }> {
	const file = path.join("corpus", name);
	try {
		const code = name.endsWith(".svelte")
			? (await component(source, { thread, file })).code
			: compileScript(source, { thread, file }).code;
		return readOutput(code);
	} catch (error) {
		return { error: (error as Error).message.split("\n")[0]! };
	}
}

describe("the main-thread function transform, over the corpus", () => {
	const names = inputs();

	it("has the inputs", () => {
		expect(names.length).toBeGreaterThan(25);
	});

	it.each(names)("%s", async (name) => {
		const source = fs.readFileSync(path.join(corpus, name), "utf8");
		const background = await form(source, "background", name);
		const mainThread = await form(source, "main-thread", name);
		expect({ background, mainThread }).toMatchSnapshot();
		// Both threads agree on the functions: the background sends an id, the main thread runs the
		// body registered under it.
		if (!("error" in background) && !("error" in mainThread)) {
			const ids = background.functions.map((entry) => entry.id);
			expect(mainThread.functions.map((entry) => entry.id)).toEqual(ids);
			expect([...mainThread.registrations].sort()).toEqual([...ids].sort());
			// Only the main thread has the bodies.
			expect(background.registrations).toEqual([]);
			const global = NOT_CAPTURED[name.split(path.sep).join("/")];
			if (global) {
				expect(source).toContain(global.name);
				for (const fn of [...background.functions, ...mainThread.functions]) {
					expect(fn.captures.some((capture) => capture.split(".")[0] === global.name)).toBe(false);
				}
			}
		}
	});

	it("refuses every input of rejected/, and only those", async () => {
		for (const name of names) {
			const result = await form(
				fs.readFileSync(path.join(corpus, name), "utf8"),
				"background",
				name,
			);
			expect("error" in result, name).toBe(name.startsWith("rejected"));
		}
	});
});
