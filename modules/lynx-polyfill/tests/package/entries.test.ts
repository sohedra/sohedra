// Each of the package's imports, as an app's build bundles it for each thread (entry-script.ts),
// run in a realm with only the language's built-ins and what a Lynx thread gives its scripts: the
// globals it puts there, each of which loads when read, and its size, minified and gzip, as a
// budget. A change that grows an import updates the snapshot on purpose.

import vm from "node:vm";
import zlib from "node:zlib";

import { describe, expect, it } from "@rstest/core";

import type { Thread } from "../../src/fills/globals.ts";
import { bundleEntry, PACKAGE_NAME, subpaths, threadRealm } from "./entry-script.ts";

const THREADS: readonly Thread[] = ["background", "main-thread"];

/** The names a script added to the realm's global object, each read once. */
function run(code: string, thread: Thread): string[] {
	const { context, reports } = threadRealm(thread);
	const before = new Set(
		vm.runInContext("Object.getOwnPropertyNames(globalThis)", context) as string[],
	);
	vm.runInContext(code, context);
	const added = (vm.runInContext("Object.getOwnPropertyNames(globalThis)", context) as string[])
		.filter((name) => !before.has(name))
		.sort();
	for (const name of added) vm.runInContext(`void globalThis[${JSON.stringify(name)}]`, context);
	expect(reports).toEqual([]);
	return added;
}

/** A size, rounded up to the next 1,000 bytes: the budget a snapshot holds. */
const budget = (bytes: number): number => Math.ceil(bytes / 1000) * 1000;

describe.each(subpaths())(`import "${PACKAGE_NAME}%s"`, (subpath) => {
	it.each(THREADS)(
		"on the %s: its globals, and its size within budget",
		async (thread) => {
			const code = await bundleEntry({ subpath, thread, minimize: true });
			expect(run(code, thread)).toMatchSnapshot();
			expect({
				minified: budget(Buffer.byteLength(code)),
				gzip: budget(zlib.gzipSync(code, { level: 9 }).byteLength),
			}).toMatchSnapshot();
		},
		60_000,
	);
});

describe(`import "${PACKAGE_NAME}/fetch" on the main thread alone`, () => {
	it("makes a Response with a body, and a Request of a URL it parses", async () => {
		const code = await bundleEntry({ subpath: "/fetch", thread: "main-thread", minimize: true });
		const { context } = threadRealm("main-thread");
		vm.runInContext(code, context);
		const read = vm.runInContext(
			`new Response("x").text().then((text) => [text, new Request("https://a.example/b/../c").url])`,
			context,
		) as Promise<unknown>;
		expect(await read).toEqual(["x", "https://a.example/c"]);
	}, 60_000);
});
