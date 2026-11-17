// `import "background-only"` keeps a module off the main thread: there the module is a stub with
// the same exports. The loader runs last on every main-thread script, `node_modules` included, so
// a module without the marker must cost nothing.

import vm from "node:vm";

import { describe, expect, it } from "@rstest/core";

import { backgroundOnlyStub } from "../../../../src/build/loaders/background-only-stub.ts";
import backgroundOnlyLoader from "../../../../src/build/loaders/background-only.ts";
import { runLoader } from "./loader-context.ts";

const MARKER = "/binding/background/background-only.ts";

const stub = (source: string, file = "/app/src/store.ts") =>
	backgroundOnlyStub({ source, resourcePath: file, rootContext: "/app", marker: MARKER });

const load = (source: string, run: object = {}, map?: unknown) =>
	runLoader(
		backgroundOnlyLoader,
		source,
		{ file: "store.ts", options: { marker: MARKER }, ...run },
		map,
	);

describe("a module without the marker", () => {
	it("is returned at once, as it is, with the map it came with", async () => {
		const map = { version: 3, mappings: "AAAA", sources: ["a.ts"] };
		const result = await load("export const a = 1;\n", {}, map);
		expect(result.sync).toBe(true);
		expect(result.code).toBe("export const a = 1;\n");
		expect(result.map).toBe(map);
	});

	it("is left alone when its path is Svelte's own source, whatever it holds", async () => {
		const source = 'import "background-only";\nexport const a = 1;\n';
		const result = await load(source, { file: "../node_modules/svelte/src/index.js" });
		expect(result.sync).toBe(true);
		expect(result.code).toBe(source);
	});

	it("is left as it is when it only names the marker in a string or a comment", async () => {
		const source = '// import "background-only"\nexport const a = "background-only";\n';
		expect(await stub(source)).toBe(source);
	});
});

describe("a module with the marker", () => {
	it("becomes a stub with the same exports, so its imports never reach the main thread", async () => {
		const code = await stub(
			'import "background-only";\nimport heavy from "heavy";\nexport const a = heavy;\nexport function b() {}\nexport default 1;\n',
		);
		expect(code).not.toContain("heavy");
		expect(code).toContain("export { _0 as a, _1 as b, _2 as default };");
		expect(code).toContain('const file = "src/store.ts";');
	});

	it("stubs a CommonJS module as module.exports", async () => {
		const code = await stub('require("background-only");\nmodule.exports = { a: 1 };\n');
		expect(code).toContain("module.exports = stub('module.exports');");
	});

	it("fails for `export *`, naming the file and the fix", async () => {
		await expect(
			stub('import "background-only";\nexport * from "./other";\n'),
		).rejects.toMatchObject({
			code: "background_only_reexport_all",
		});
		await expect(stub('import "background-only";\nexport * from "./other";\n')).rejects.toThrow(
			/src\/store\.ts[^]*export \{ a, b \} from '\.\/other'/,
		);
	});

	it("fails for a component, which renders on the main thread for the first frame", async () => {
		await expect(stub('import "background-only";', MARKER)).rejects.toMatchObject({
			code: "background_only_in_component",
		});
	});

	it("is a stub that throws when the first frame uses it, saying what was used and where to move it", async () => {
		const code = await stub('import "background-only";\nexport const store = {};\n');
		const store = vm.runInNewContext(`${code.replace(/export \{[^}]*\};/, "")}\n_0`) as {
			value: unknown;
		};
		expect(() => store.value).toThrow(
			/^The first frame used `store\.value`, from the background-only module src\/store\.ts\./,
		);
		expect(() => store.value).toThrow(/onMount, \$effect or an event handler/);
		expect(typeof store).toBe("function");
	});
});

describe("the loader", () => {
	it("gives the stub, and no map: the stub is not the source", async () => {
		const result = await load(
			'import "background-only";\nexport const a = 1;\n',
			{},
			{ version: 3 },
		);
		expect(result.code).toContain("const file =");
		expect(result.map).toBeUndefined();
	});

	it("fails with the build's message", async () => {
		const result = await load('import "background-only";\nexport * from "./x";\n');
		expect(result.error).toMatchObject({ code: "background_only_reexport_all", hideStack: true });
	});
});
