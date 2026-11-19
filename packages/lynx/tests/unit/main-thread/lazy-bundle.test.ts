// The main thread's side of a lazy bundle: it runs the bundle's main-thread section, installs and
// runs the bundler's chunk it answers, then adopts the bundle's styles, once per bundle. An
// `import()` there, which only the first frame makes, starts the download and never settles.

import { afterEach, describe, expect, it } from "@rstest/core";

import { installLazyBundles, takeLazyBundle } from "../../../src/main-thread/lazy-bundle.ts";
import { installGlobals, readGlobal } from "../../../src/testing/globals.ts";

// The bundler's own runtime, in this test's bundle as in the page's main-thread script: `.m` holds
// its modules, `.C` installs a chunk.
declare const __webpack_require__: { m: Record<string, unknown>; C?: (chunk: unknown) => void };
const installChunk = __webpack_require__.C;

let restore = (): void => {};
afterEach(() => {
	restore();
	__webpack_require__.C = installChunk;
});

let bundles = 0;
/** A URL no other test took: the main thread takes each bundle once for the view's life. */
const fresh = (name: string): string =>
	`http://localhost:3002/lazy-bundle/${name}.${++bundles}.bundle`;

/** A main thread whose engine has the bundle, recording what is done with it, in order. */
function fakeMainThread() {
	const steps: string[] = [];
	const run = (id: string) => () => void steps.push(`run ${id}`);
	const id = `heavy:${++bundles}`;
	const chunk = {
		ids: ["heavy"],
		modules: { [`${id}a`]: run(`${id}a`), [`${id}b`]: run(`${id}b`) },
	};
	const lynx = {
		fetchBundle: (url: string) => ({
			wait(seconds: number) {
				steps.push(`wait ${url} ${seconds}`);
				return { url: `${url}#cached`, code: 0 };
			},
		}),
		loadScript(section: string, options: { bundleName: string }): unknown {
			steps.push(`loadScript ${section} ${options.bundleName}`);
			return (entry: string) => {
				steps.push(`evaluate ${entry}`);
				return chunk;
			};
		},
	};
	restore = installGlobals({
		lynx,
		__LoadStyleSheet: (section: string, bundle: string) => {
			steps.push(`styles ${section} ${bundle}`);
			return "sheet";
		},
		__AdoptStyleSheet: (sheet: unknown) => void steps.push(`adopt ${String(sheet)}`),
	});
	__webpack_require__.C = (installed) => {
		steps.push(`install ${String(installed === chunk)}`);
		Object.assign(__webpack_require__.m, chunk.modules);
	};
	return { steps, lynx, id };
}

describe("takeLazyBundle", () => {
	it("runs the main-thread section, installs and runs its modules, then adopts its styles, once", () => {
		const { steps, id } = fakeMainThread();
		const errors: unknown[] = [];
		const url = fresh("Heavy");
		takeLazyBundle({ url }, (error) => errors.push(error));
		takeLazyBundle({ url }, (error) => errors.push(error));
		expect(errors).toEqual([]);
		expect(steps).toEqual([
			`wait ${url} 5`,
			`loadScript main-thread ${url}#cached`,
			`evaluate ${url}`,
			"install true",
			`run ${id}a`,
			`run ${id}b`,
			`styles CSS ${url}#cached`,
			"adopt sheet",
		]);
	});

	it("adopts the styles of a bundle with no main-thread section, and reports nothing", () => {
		const { steps, lynx } = fakeMainThread();
		lynx.loadScript = () => {
			throw new Error("lynx.loadScript's script is empty.key: main-thread");
		};
		const errors: unknown[] = [];
		const url = fresh("Styles");
		takeLazyBundle({ url }, (error) => errors.push(error));
		expect(errors).toEqual([]);
		expect(steps).toEqual([`wait ${url} 5`, `styles CSS ${url}#cached`, "adopt sheet"]);
	});

	it("reports what the main-thread section throws", () => {
		const { lynx } = fakeMainThread();
		const failure = new Error("the section threw");
		lynx.loadScript = () => () => {
			throw failure;
		};
		const errors: unknown[] = [];
		takeLazyBundle({ url: fresh("Bad") }, (error) => errors.push(error));
		expect(errors).toEqual([failure]);
	});

	it("reports a bundle the main thread does not get, and tries again at the next import", () => {
		const { steps, lynx } = fakeMainThread();
		const fetch = lynx.fetchBundle;
		lynx.fetchBundle = () => ({ wait: () => ({ url: "", code: 1601 }) });
		const errors: unknown[] = [];
		const url = fresh("Late");
		takeLazyBundle({ url }, (error) => errors.push(error));
		expect(errors).toEqual([expect.objectContaining({ code: "lazy_bundle_not_on_main_thread" })]);
		lynx.fetchBundle = fetch;
		takeLazyBundle({ url }, (error) => errors.push(error));
		expect(errors).toHaveLength(1);
		expect(steps).toContain(`loadScript main-thread ${url}#cached`);
	});
});

describe("import() on the main thread", () => {
	it("starts the download, and never settles", async () => {
		const { lynx } = fakeMainThread();
		const fetched: string[] = [];
		lynx.fetchBundle = (url: string) => {
			fetched.push(url);
			return { wait: () => ({ url, code: 0 }) };
		};
		installLazyBundles();
		const page = readGlobal("lynx") as { loadLazyBundle(url: string): Promise<unknown> };
		let settled = false;
		const url = fresh("Early");
		void page.loadLazyBundle(url).then(
			() => (settled = true),
			() => (settled = true),
		);
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(settled).toBe(false);
		expect(fetched).toEqual([url]);
	});

	it("never settles when the fetch throws, which was only a head start", async () => {
		const { lynx } = fakeMainThread();
		lynx.fetchBundle = () => {
			throw new Error("no network");
		};
		installLazyBundles();
		const page = readGlobal("lynx") as { loadLazyBundle(url: string): Promise<unknown> };
		let settled = false;
		void page.loadLazyBundle(fresh("Offline")).then(
			() => (settled = true),
			() => (settled = true),
		);
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(settled).toBe(false);
	});
});
