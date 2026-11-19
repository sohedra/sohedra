// A lazy bundle across both threads of a page on the engine fake: the background fetches it, runs
// its background section and asks the main thread to take it; the main thread runs its main-thread
// section and adopts its styles; then the background's promise resolves. A bundle that does not
// arrive rejects, and only Lynx reports it.

import { describe, expect, it } from "@rstest/core";

import type { TestBundle } from "../../src/testing/index.ts";
import Counter from "../fixtures/threads/Counter.svelte";
import { startSveltePage } from "./svelte-page.ts";
import type { SveltePage } from "./svelte-page.ts";

const PAGE = "http://localhost:3002/main.lynx.bundle";

let count = 0;
/** A bundle URL no other test used: the main thread takes a bundle once for the view's life. */
const fresh = (): string => `http://localhost:3002/lazy-bundle/Heavy.${++count}.bundle`;

function withBundle(url: string, bundle: TestBundle) {
	return startSveltePage(Counter, { url: PAGE, bundles: { [url]: bundle } });
}

/** `import()` on the background: the chunk loader's call of `lynx.loadLazyBundle`. */
function load(page: SveltePage, url: string): Promise<unknown> {
	return page.asBackground(() => page.lynx.background.loadLazyBundle!(url));
}

describe("a lazy bundle on both threads", () => {
	it("resolves with the background's chunk once the main thread ran its section and took its styles", async () => {
		const url = fresh();
		const entries: string[] = [];
		const chunk = { ids: ["heavy"], modules: {} };
		const styles = { sheet: "heavy" };
		const page = withBundle(url, {
			background: () => chunk,
			mainThread: () => (entry: string) => {
				entries.push(entry);
				// No modules: installing them is the bundler's runtime's, which a unit test covers.
				return {};
			},
			styles,
		});
		await page.settle();
		let loaded: unknown;
		void load(page, url).then((value) => (loaded = value));
		await page.settle();
		expect(loaded).toBe(chunk);
		expect(entries).toEqual([url]);
		expect(page.engine.adoptedStyleSheets).toEqual([styles]);
		expect(page.errors).toEqual([]);
	});

	it("resolves a path against the page's URL", async () => {
		const url = fresh();
		const page = withBundle(url, { background: () => "chunk" });
		await page.settle();
		const loading = load(page, new URL(url).pathname);
		await page.settle();
		await expect(loading).resolves.toBe("chunk");
	});

	it("takes the styles of a bundle with no main-thread section, and reports nothing", async () => {
		const url = fresh();
		const styles = { sheet: "styles only" };
		const page = withBundle(url, { background: () => "chunk", styles });
		await page.settle();
		const loading = load(page, url);
		await page.settle();
		await expect(loading).resolves.toBe("chunk");
		expect(page.engine.adoptedStyleSheets).toEqual([styles]);
		expect(page.errors).toEqual([]);
	});

	it("rejects a bundle that does not arrive, which Lynx alone reports", async () => {
		const url = fresh();
		const page = withBundle(url, { code: 1601, message: "Failed to connect" });
		await page.settle();
		const outcome = load(page, url).catch((error: unknown) => error);
		await page.settle();
		expect(await outcome).toMatchObject({
			code: "lazy_bundle_not_loaded",
			cause: { code: 1601, url, error_msg: "Failed to connect" },
		});
		expect(page.errors.map(String)).toEqual([
			`Error: Lynx could not load the bundle ${url}: Failed to connect`,
		]);
	});

	it("has the main thread's import() start the download and never settle", async () => {
		const url = fresh();
		const page = withBundle(url, { background: () => "chunk" });
		await page.settle();
		let settled = false;
		void page
			.asMainThread(() => page.lynx.mainThread.loadLazyBundle!(url))
			.then(() => (settled = true));
		await page.settle();
		expect(settled).toBe(false);
	});
});
