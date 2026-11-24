// Svelte's paths that copy or walk state read the globals `EventTarget` and `structuredClone`
// (svelte/src/internal/shared/clone.js, internal/client/runtime.js), which neither of a device's
// threads has: a page built for production and for development, run on threads shaped like a
// device's (device-threads.ts).

import vm from "node:vm";

import { afterEach, beforeAll, describe, expect, it, rs } from "@rstest/core";

import type { LynxElement, TestPage } from "../../src/testing/index.ts";
import { scriptsOf } from "./build-app.ts";
import type { AppBuild } from "./build-app.ts";
import { startDevicePage } from "./device-threads.ts";
import { sharedBuild } from "./shared-build.ts";

const MODES = ["production", "development"] as const;
const builds = new Map<(typeof MODES)[number], AppBuild>();
let actionBuild: AppBuild;

beforeAll(async () => {
	for (const mode of MODES) builds.set(mode, await sharedBuild(mode, "snapshot"));
	actionBuild = await sharedBuild("production", "snapshot-action");
}, 480_000);
afterEach(() => {
	rs.restoreAllMocks();
});

/** The first element with this class token. */
function byClass(page: TestPage, token: string): LynxElement {
	const found = page.engine
		.all()
		.find((element) => page.engine.state(element).classes.split(" ").includes(token));
	if (!found) throw new Error(`No element has the class ${token}.`);
	return found;
}

describe.each(MODES)("a page built for %s, on threads shaped like a device's", (mode) => {
	let scripts: ReturnType<typeof scriptsOf>;
	beforeAll(() => {
		const build = builds.get(mode)!;
		expect(build.error + build.messages).toBe("");
		scripts = scriptsOf(build);
	});

	/** Starts the page with the console's logs kept, and settles it. */
	async function start() {
		const logs: unknown[][] = [];
		rs.spyOn(console, "log").mockImplementation((...args: unknown[]) => void logs.push(args));
		const device = startDevicePage(scripts);
		await device.page.settle();
		return { ...device, logs };
	}

	it("has a global EventTarget and structuredClone on both threads", async () => {
		const { page, mainThread, background } = await start();
		try {
			const kinds = "[typeof EventTarget, typeof structuredClone]";
			expect(vm.runInContext(kinds, mainThread)).toEqual(["function", "function"]);
			expect(vm.runInContext(kinds, background)).toEqual(["function", "function"]);
		} finally {
			page.dispose();
		}
	});

	it("has atob and btoa on both threads, which refuse what the standard refuses", async () => {
		const { page, mainThread, background } = await start();
		try {
			const probe = `[btoa("\\xff"), atob(" YQ\\n"), (() => { try { atob("!"); } catch (error) { return error.name; } })()]`;
			const answer = ["/w==", "a", "InvalidCharacterError"];
			expect(vm.runInContext(probe, mainThread)).toEqual(answer);
			expect(vm.runInContext(probe, background)).toEqual(answer);
		} finally {
			page.dispose();
		}
	});

	it("has the web's globals each thread is given, built from the scripts' own fills", async () => {
		const { page, mainThread, background } = await start();
		try {
			const both = `[
				new URL("../b?c=1", "https://a.example/x/y").href,
				new TextDecoder().decode(new TextEncoder().encode("é€")),
				new DOMException("m", "AbortError").code,
				typeof performance.now(),
				navigator.userAgent.startsWith("Lynx"),
				self === globalThis,
				(() => { const c = new AbortController(); c.abort(); return c.signal.reason.name; })(),
				new Headers({ "A-B": "1" }).get("a-b"),
				(() => { let heard; addEventListener("error", (e) => { heard = e.message; e.preventDefault(); }); reportError(new Error("seen")); return heard; })(),
			]`;
			const answer = [
				"https://a.example/b?c=1",
				"é€",
				20,
				"number",
				true,
				true,
				"AbortError",
				"1",
				"seen",
			];
			expect(vm.runInContext(both, mainThread)).toEqual(answer);
			expect(vm.runInContext(both, background)).toEqual(answer);
			const streams = `(async () => {
				const response = new Response(new Blob(["a", "b"]).stream().pipeThrough(new TextDecoderStream()).pipeThrough(new TextEncoderStream()));
				return [await response.text(), typeof fetch, typeof ReadableStream.from];
			})()`;
			expect(await vm.runInContext(streams, background)).toEqual(["ab", "function", "function"]);
			const mainFetch = `(() => { try { fetch("https://a.example/"); } catch (error) { return [error.code, typeof ReadableStream]; } })()`;
			expect(vm.runInContext(mainFetch, mainThread)).toEqual(["fetch_on_main_thread", "undefined"]);
		} finally {
			page.dispose();
		}
	});

	it("copies a primitive as it is, and refuses a symbol and a function with a DataCloneError", async () => {
		const { page, mainThread, background } = await start();
		try {
			const probe = `[
				[undefined, null, true, 0, -0, NaN, 10n, "text"].every((value) => Object.is(structuredClone(value), value)),
				[Symbol("unique"), () => {}].map((value) => {
					try {
						structuredClone(value);
					} catch (error) {
						return error instanceof DOMException && error.name;
					}
				}),
			]`;
			const answer = [true, ["DataCloneError", "DataCloneError"]];
			expect(vm.runInContext(probe, mainThread)).toEqual(answer);
			expect(vm.runInContext(probe, background)).toEqual(answer);
		} finally {
			page.dispose();
		}
	});

	it("draws a snapshot of state with a date, a map and nested arrays on both threads", async () => {
		const { page } = await start();
		try {
			expect(page.errors.map(String)).toEqual([]);
			expect(page.engine.texts()).toEqual(["0 1 [[1,2],[3,[4]]] true", "Updated with none"]);
		} finally {
			page.dispose();
		}
	});

	it("takes a snapshot in a tap, and calls an action's update with an object", async () => {
		const { page } = await start();
		try {
			page.engine.dispatch(byClass(page, "button"), { type: "tap" });
			await page.settle();
			expect(page.errors.map(String)).toEqual([]);
			expect(page.engine.texts()).toEqual(["0 1 [[1,2,1],[3,[4]]] true", "Updated with 1"]);
		} finally {
			page.dispose();
		}
	});

	it("logs the value of {@debug} as a copy", async () => {
		const { page, logs } = await start();
		try {
			page.engine.dispatch(byClass(page, "button"), { type: "tap" });
			await page.settle();
			expect(page.errors.map(String)).toEqual([]);
			expect(logs).toContainEqual([{ taps: 0 }]);
			expect(logs).toContainEqual([{ taps: 1 }]);
		} finally {
			page.dispose();
		}
	});

	it.runIf(mode === "development")("logs $inspect's value as a copy", async () => {
		const { page, logs } = await start();
		try {
			expect(page.errors.map(String)).toEqual([]);
			expect(logs).toContainEqual([
				{
					when: new Date(0),
					sizes: new Map([["a", 1]]),
					rows: [
						[1, 2],
						[3, [4]],
					],
				},
			]);
		} finally {
			page.dispose();
		}
	});
});

describe("a page whose only read of EventTarget is an action's object, on threads shaped like a device's", () => {
	it("calls the action's update", async () => {
		expect(actionBuild.error + actionBuild.messages).toBe("");
		const { page } = startDevicePage(scriptsOf(actionBuild));
		try {
			await page.settle();
			page.engine.dispatch(byClass(page, "button"), { type: "tap" });
			await page.settle();
			expect(page.errors.map(String)).toEqual([]);
			expect(page.engine.texts()).toEqual(["Updated with 1"]);
		} finally {
			page.dispose();
		}
	});
});
