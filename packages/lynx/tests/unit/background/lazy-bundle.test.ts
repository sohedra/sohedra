// The background's loader of lazy bundles, against a `lynx` of its own: it fetches the bundle, runs
// its background section, has the main thread take it, then resolves; one timer covers it all.

import { afterEach, describe, expect, it, rs } from "@rstest/core";

import { loadLazyBundle, resolveUrl } from "../../../src/background/lazy-bundle.ts";
import { installGlobals } from "../../../src/testing/globals.ts";
import { LAZY_BUNDLE_METHOD } from "../../../src/wire/index.ts";

const PAGE = "http://localhost:3002/main.lynx.bundle?fullscreen=true";

let restore = (): void => {};
afterEach(() => {
	restore();
	rs.useRealTimers();
});

describe("resolveUrl", () => {
	it("resolves against the page's URL, as a browser resolves a link", () => {
		expect(resolveUrl("/lazy-bundle/a.bundle", PAGE)).toBe(
			"http://localhost:3002/lazy-bundle/a.bundle",
		);
		expect(resolveUrl("lazy-bundle/a.bundle", "https://cdn.example/app/main.lynx.bundle?x=1")).toBe(
			"https://cdn.example/app/lazy-bundle/a.bundle",
		);
		expect(resolveUrl("//cdn.example/a.bundle", PAGE)).toBe("http://cdn.example/a.bundle");
		expect(resolveUrl("/a.bundle", "http://host")).toBe("http://host/a.bundle");
		expect(resolveUrl("a.bundle", "https://cdn.example/app/main.bundle?from=/x/y#z/w")).toBe(
			"https://cdn.example/app/a.bundle",
		);
	});

	it("leaves a full URL, and anything without a full base, as it is", () => {
		expect(resolveUrl("https://cdn.example/a.bundle", PAGE)).toBe("https://cdn.example/a.bundle");
		expect(resolveUrl("/a.bundle", undefined)).toBe("/a.bundle");
		expect(resolveUrl("/a.bundle", "main.lynx.bundle")).toBe("/a.bundle");
	});
});

/** A background `lynx` whose fetches the test answers, recording what the loader asks, in order. */
function fakeBackground(srcName: string | null = PAGE) {
	const steps: string[] = [];
	let answer: ((bundle: unknown) => void) | undefined;
	let taken: (() => void) | undefined;
	restore = installGlobals({
		lynx: {
			getApp: () => ({ _params: srcName === null ? {} : { srcName } }),
			fetchBundle(url: string) {
				steps.push(`fetch ${url}`);
				return {
					// oxlint-disable-next-line unicorn/no-thenable -- Lynx's fetch answers a thenable
					then(callback: (bundle: unknown) => void) {
						answer = callback;
					},
				};
			},
			loadScript(section: string, options: { bundleName: string }) {
				steps.push(`loadScript ${section} ${options.bundleName}`);
				return { ids: ["heavy"], modules: {} };
			},
			getNativeApp: () => ({
				callLepusMethod(name: string, params: { url: string }, callback: () => void) {
					steps.push(`${name} ${params.url}`);
					taken = callback;
				},
			}),
		},
	});
	return {
		steps,
		answer: (bundle: unknown) => answer?.(bundle),
		take: () => taken?.(),
	};
}

const URL = "http://localhost:3002/lazy-bundle/Heavy.bundle";

describe("loadLazyBundle", () => {
	it("fetches, runs the background section, and resolves once the main thread took the bundle", async () => {
		const { steps, answer, take } = fakeBackground();
		let chunk: unknown;
		const loading = loadLazyBundle("/lazy-bundle/Heavy.bundle").then((value) => (chunk = value));
		answer({ url: `${URL}#cached`, code: 0 });
		expect(steps).toEqual([
			`fetch ${URL}`,
			`loadScript background ${URL}#cached`,
			`${LAZY_BUNDLE_METHOD} ${URL}`,
		]);
		await Promise.resolve();
		expect(chunk).toBeUndefined();
		take();
		await loading;
		expect(chunk).toEqual({ ids: ["heavy"], modules: {} });
	});

	it("rejects with Lynx's answer when the bundle does not arrive, which Lynx reported", async () => {
		const { answer, steps } = fakeBackground();
		const bundle = { url: "", code: 1601, error_msg: "Failed to connect" };
		const loading = loadLazyBundle(URL);
		answer(bundle);
		const error = (await loading.catch((thrown: unknown) => thrown)) as Error & {
			code: string;
			cause: unknown;
		};
		expect(error.code).toBe("lazy_bundle_not_loaded");
		expect(error.message).toMatch(/^The lazy bundle .*Heavy\.bundle did not load: .* 1601/);
		expect(error.cause).toBe(bundle);
		expect(steps).toEqual([`fetch ${URL}`]);
	});

	it("rejects at once, fetching nothing, when no full URL can be made", async () => {
		const { steps } = fakeBackground(null);
		await expect(loadLazyBundle("/lazy-bundle/x.bundle")).rejects.toMatchObject({
			code: "lazy_bundle_address_not_full",
		});
		expect(steps).toEqual([]);
	});

	it("rejects with what running the background section threw", async () => {
		const { answer } = fakeBackground();
		const failure = new Error("the section threw");
		const loading = loadLazyBundle(URL);
		(globalThis as unknown as { lynx: { loadScript(): never } }).lynx.loadScript = () => {
			throw failure;
		};
		answer({ url: URL, code: 0 });
		await expect(loading).rejects.toBe(failure);
	});
});

describe("loadLazyBundle, a bundle that never comes", () => {
	it("rejects when the engine never answers, naming the URL, and not before 30 seconds", async () => {
		rs.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
		fakeBackground();
		let outcome: unknown;
		const loading = loadLazyBundle(URL).catch((error: unknown) => (outcome = error));
		await rs.advanceTimersByTimeAsync(29_000);
		expect(outcome).toBeUndefined();
		await rs.advanceTimersByTimeAsync(2_000);
		await loading;
		expect(outcome).toMatchObject({ code: "lazy_bundle_timed_out" });
		expect(String(outcome)).toContain(`${URL} did not load within 30 seconds`);
	});

	it("rejects when the main thread never takes it", async () => {
		rs.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
		const { answer, steps } = fakeBackground();
		let outcome: unknown;
		const loading = loadLazyBundle(URL).catch((error: unknown) => (outcome = error));
		answer({ url: URL, code: 0 });
		await rs.advanceTimersByTimeAsync(31_000);
		await loading;
		expect(steps.at(-1)).toBe(`${LAZY_BUNDLE_METHOD} ${URL}`);
		expect(outcome).toMatchObject({ code: "lazy_bundle_timed_out" });
	});

	it("runs nothing for an answer after the timeout, and settles once", async () => {
		rs.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
		const { answer, steps } = fakeBackground();
		const outcomes: string[] = [];
		const loading = loadLazyBundle(URL).then(
			() => outcomes.push("resolved"),
			() => outcomes.push("rejected"),
		);
		await rs.advanceTimersByTimeAsync(31_000);
		await loading;
		answer({ url: URL, code: 0 });
		await rs.advanceTimersByTimeAsync(0);
		expect(steps).toEqual([`fetch ${URL}`]);
		expect(outcomes).toEqual(["rejected"]);
	});

	it("drops the main thread's answer after the timeout", async () => {
		rs.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
		const { answer, take } = fakeBackground();
		const outcomes: string[] = [];
		const loading = loadLazyBundle(URL).then(
			() => outcomes.push("resolved"),
			() => outcomes.push("rejected"),
		);
		answer({ url: URL, code: 0 });
		await rs.advanceTimersByTimeAsync(31_000);
		await loading;
		take();
		await rs.advanceTimersByTimeAsync(0);
		expect(outcomes).toEqual(["rejected"]);
	});

	it("leaves no timer behind once a bundle has loaded, or failed", async () => {
		rs.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
		const loaded = fakeBackground();
		const loading = loadLazyBundle(URL);
		loaded.answer({ url: URL, code: 0 });
		loaded.take();
		await loading;
		expect(rs.getTimerCount()).toBe(0);
		const failed = fakeBackground();
		const failing = loadLazyBundle(URL).catch(() => {});
		failed.answer({ url: "", code: 1601 });
		await failing;
		expect(rs.getTimerCount()).toBe(0);
	});
});
