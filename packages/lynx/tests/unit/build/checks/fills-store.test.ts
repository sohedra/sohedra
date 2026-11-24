// What each module waits on hangs on its build's compiler, for the plugin to decide once every
// module is known. A build restored from a persistent cache compiles again each module whose entry
// matters; a watch run keeps the entries, and the compile cache.

import { describe, expect, it } from "@rstest/core";

import {
	createFillsStore,
	NO_FILLS,
	recordFills,
} from "../../../../src/build/checks/fills-store.ts";
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
	{ file: inApp("encode.ts"), text: "export const e = () => new TextEncoder();" },
	APP_ROOT,
);
const installing: ModuleFills = { ...NO_FILLS, installs: ["TextEncoder"] };
const persistent = { options: { cache: { type: "persistent" } } };

describe("a build's store", () => {
	it("keeps what a module waits on, and the module in the compile cache of a watch run", () => {
		const compiler = { options: { cache: true } };
		const store = createFillsStore(compiler);
		const loader = loaderOf(compiler, "/app/src/encode.ts");
		recordFills(loader, waiting);
		expect(store.modules.get("/app/src/encode.ts")).toBe(waiting);
		expect(store.persistent).toBe(false);
		expect(loader.cached).toBe(true);
	});

	it("keeps a module that waits on a fill or installs a global out of a persistent cache", () => {
		const compiler = { ...persistent };
		const store = createFillsStore(compiler);
		expect(store.persistent).toBe(true);
		for (const [file, fills] of [
			["/app/src/encode.ts", waiting],
			["/app/src/setup.ts", installing],
		] as const) {
			const loader = loaderOf(compiler, file);
			recordFills(loader, fills);
			expect(loader.cached).toBe(false);
		}
		const importing = loaderOf(compiler, "/app/src/entry.ts");
		recordFills(importing, { ...NO_FILLS, imports: ["@sohedra/lynx-polyfill"] });
		expect(importing.cached).toBe(true);
	});

	it("forgets a module that has nothing", () => {
		const compiler = {};
		const store = createFillsStore(compiler);
		const loader = loaderOf(compiler, "/app/src/entry.ts");
		recordFills(loader, installing);
		expect(store.modules.get("/app/src/entry.ts")?.installs).toEqual(["TextEncoder"]);
		recordFills(loader, NO_FILLS);
		expect(store.modules.has("/app/src/entry.ts")).toBe(false);
	});

	it("is the build's own: another compiler's, or none, keeps nothing", () => {
		const store = createFillsStore({});
		recordFills(loaderOf({}, "/app/src/a.ts"), waiting);
		recordFills(loaderOf(undefined, "/app/src/a.ts"), waiting);
		expect(store.modules.size).toBe(0);
	});
});
