// The language fills in a built page, on threads shaped like a device's (device-threads.ts): what
// PrimJS lacks of ES2022 to ES2025 is taken away from each realm, and the page's scripts bring it.
// The heavy ones (iterator helpers, Set methods, half-precision numbers, `normalize`) come only
// with code that names them, so a page that names none goes without them.

import vm from "node:vm";

import { beforeAll, describe, expect, it } from "@rstest/core";

import { scriptsOf } from "./build-app.ts";
import type { AppBuild } from "./build-app.ts";
import { startDevicePage } from "./device-threads.ts";
import type { DevicePage } from "./device-threads.ts";
import { sharedBuild } from "./shared-build.ts";

const MODES = ["production", "development"] as const;
const builds = new Map<(typeof MODES)[number], AppBuild>();

beforeAll(async () => {
	for (const mode of MODES) builds.set(mode, await sharedBuild(mode, "device"));
}, 480_000);

/** Each light fill, called as an app calls it, and what it gives. */
const PROBES: [call: string, gives: unknown][] = [
	["[1, 2, 3].at(-1)", 3],
	["[1, 2, 3].findLast((value) => value < 3)", 2],
	["[1, 2, 3].findLastIndex((value) => value < 3)", 1],
	["[3, 1, 2].toSorted().join()", "1,2,3"],
	["[1, 2].toReversed().join()", "2,1"],
	["[1, 2, 3].toSpliced(1, 1).join()", "1,3"],
	["[1, 2].with(0, 9).join()", "9,2"],
	["new Int8Array([1, 2]).at(-1)", 2],
	["new Int8Array([2, 1]).toSorted().join()", "1,2"],
	["new Int8Array([1, 2]).toReversed().join()", "2,1"],
	["new Int8Array([1, 2]).with(1, 5).join()", "1,5"],
	["'ab'.at(-1)", "b"],
	["'a.b.a'.replaceAll('a', 'x')", "x.b.x"],
	["'a\\uD800'.isWellFormed()", false],
	["'a\\uD800'.toWellFormed()", "a�"],
	["Object.hasOwn({ a: 1 }, 'a')", true],
	["Object.groupBy([1, 2, 3], (value) => (value % 2 ? 'odd' : 'even')).odd.join()", "1,3"],
	["Map.groupBy([1, 2, 3], (value) => value % 2).get(1).join()", "1,3"],
	["typeof Promise.withResolvers().resolve", "function"],
	["Promise.try(() => 1) instanceof Promise", true],
	["RegExp.escape('a.b')", "\\x61\\.b"],
	["typeof [].at", "function"],
	["Object.prototype.toString.call(Reflect)", "[object Reflect]"],
];

/** The heavy fills' globals and methods: a page that names none of them has none. */
const HEAVY = [
	"typeof Iterator",
	"typeof Set.prototype.union",
	"typeof Math.f16round",
	"typeof ''.normalize",
] as const;

describe.each(MODES)("a page built for %s, on threads shaped like a device's", (mode) => {
	let device: DevicePage;
	beforeAll(async () => {
		const build = builds.get(mode)!;
		expect(build.error + build.messages).toBe("");
		device = startDevicePage(scriptsOf(build));
		await device.page.settle();
		return () => device.page.dispose();
	});

	it.each(["mainThread", "background"] as const)(
		"has the light language fills on the %s",
		(thread) => {
			const realm = device[thread];
			const answers = PROBES.map(([call]) => vm.runInContext(call, realm) as unknown);
			expect(answers).toEqual(PROBES.map(([, gives]) => gives));
			expect(device.page.errors.map(String)).toEqual([]);
		},
	);

	it.each(["mainThread", "background"] as const)(
		"has none of the heavy ones on the %s, which it does not name",
		(thread) => {
			expect(HEAVY.map((probe) => vm.runInContext(probe, device[thread]) as unknown)).toEqual(
				HEAVY.map(() => "undefined"),
			);
		},
	);

	it("gives lynx-core's Promise, which the background's bundle names, the statics it lacks", async () => {
		// Boundary: ES2024's and ES2025's statics, which this package's types leave out.
		const { Promise: LynxPromise } = device.backgroundLynx as unknown as {
			Promise: {
				any(values: unknown[]): Promise<unknown>;
				withResolvers(): { promise: Promise<unknown>; resolve(value: unknown): void };
				try(callback: () => unknown): Promise<unknown>;
			};
		};
		await expect(LynxPromise.any([Promise.reject(new Error("no")), 2])).resolves.toBe(2);
		const { promise, resolve } = LynxPromise.withResolvers();
		resolve(3);
		await expect(promise).resolves.toBe(3);
		await expect(LynxPromise.try(() => 4)).resolves.toBe(4);
		// lynx-core's own `finally` would call 5, and reject.
		await expect(LynxPromise.try(() => 6).finally(5 as never)).resolves.toBe(6);
	});
});
