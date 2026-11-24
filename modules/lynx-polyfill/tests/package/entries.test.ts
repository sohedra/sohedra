// Each of the package's imports, as an app's build bundles it for each thread (entry-script.ts),
// run in a realm with only the language's built-ins and what a Lynx thread gives its scripts: the
// globals it puts there, each of which loads when read, and its size, minified and gzip, as a
// budget. A change that grows an import updates the snapshot on purpose.

import vm from "node:vm";
import zlib from "node:zlib";

import { describe, expect, it } from "@rstest/core";

import type { Thread } from "../../src/fills/globals.ts";
import { bundleEntry, PACKAGE_NAME, subpaths } from "./entry-script.ts";

const THREADS: readonly Thread[] = ["background", "main-thread"];

/** A realm shaped like a Lynx thread's: the language's built-ins, `lynx`, timers and `console`. */
function threadRealm(thread: Thread): { context: vm.Context; reports: unknown[] } {
	const reports: unknown[] = [];
	const systemInfo = { platform: "Android", engineVersion: "4.2" };
	const lynx: Record<string, unknown> = {
		reportError: (error: unknown) => void reports.push(error),
	};
	const context = vm.createContext({});
	const own: Record<string, unknown> = {
		lynx,
		console: { log() {}, warn() {}, error() {} },
		setTimeout,
		clearTimeout,
		setInterval,
		clearInterval,
	};
	if (thread === "background") {
		lynx["queueMicrotask"] = queueMicrotask;
		own["SystemInfo"] = systemInfo;
	} else lynx["SystemInfo"] = systemInfo;
	// The realm's own `process` is absent, as on a device: the package reads it as a production build.
	for (const [name, value] of Object.entries(own))
		Object.defineProperty(context, name, { value, writable: true, configurable: true });
	return { context, reports };
}

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
