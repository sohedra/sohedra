// What each module waits on hangs on its build's compiler, for the plugin to decide once every
// module is known; a module that waits is never taken from the build cache.

import { describe, expect, it } from "@rstest/core";

import { createFillsStore, recordFills } from "../../../../src/build/checks/fills-store.ts";
import type { ModuleFills } from "../../../../src/build/checks/fills-store.ts";
import { checkModule } from "../../../../src/build/checks/module-checks.ts";
import { APP_ROOT, inApp } from "../app.ts";

/** A loader's context for `file` in the build of `compiler`, which says whether it is cacheable. */
function loaderOf(compiler: object | undefined, file: string) {
	const context = {
		_compiler: compiler,
		resourcePath: file,
		cacheable: (flag = true) => {
			context.cached = flag;
		},
		cached: true,
	};
	return context;
}

const waiting: ModuleFills = checkModule(
	{ file: inApp("encode.ts"), text: "export const e = new TextEncoder();" },
	APP_ROOT,
);

describe("a build's store", () => {
	it("keeps what a module waits on, and keeps that module out of the cache", () => {
		const compiler = {};
		const store = createFillsStore(compiler);
		const loader = loaderOf(compiler, "/app/src/encode.ts");
		recordFills(loader, waiting);
		expect(store.get("/app/src/encode.ts")).toBe(waiting);
		expect(loader.cached).toBe(false);
	});

	it("keeps a module's own imports of fills, and forgets a module that has nothing", () => {
		const compiler = {};
		const store = createFillsStore(compiler);
		const loader = loaderOf(compiler, "/app/src/entry.ts");
		recordFills(loader, { pending: [], imports: ["@sohedra/lynx-polyfill"] });
		expect(store.get("/app/src/entry.ts")?.imports).toEqual(["@sohedra/lynx-polyfill"]);
		expect(loader.cached).toBe(true);
		recordFills(loader, { pending: [], imports: [] });
		expect(store.has("/app/src/entry.ts")).toBe(false);
	});

	it("is the build's own: another compiler's, or none, keeps nothing", () => {
		const store = createFillsStore({});
		recordFills(loaderOf({}, "/app/src/a.ts"), waiting);
		recordFills(loaderOf(undefined, "/app/src/a.ts"), waiting);
		expect(store.size).toBe(0);
	});
});
