// A main-thread function cannot call a plain background function: the main thread has no copy of
// it. A development build says so where the function is made; a production build writes nothing
// extra.

import path from "node:path";

import { describe, expect, it } from "@rstest/core";

import { APP_ROOT } from "../app.ts";
import { compileScript, component } from "../compiling.ts";
import { evaluate } from "./output.ts";

const source = `function save(n) {}
const handler = () => { "main thread"; };
const hold = { go() {} };
export function f() {
  "main thread";
  save(1);
  handler();
  hold.go();
  return 1;
}
`;

describe("the plain-function callee check", () => {
	it("is in a development build of the background thread", () => {
		const { code } = compileScript(source, { development: true });
		expect(code).toMatch(/save: typeof save === "function"/);
		// A main-thread function of the same script, and an object's method, are not plain functions called through a capture.
		expect(code).not.toMatch(/handler: typeof/);
		expect(code).not.toMatch(/hold: typeof/);
	});

	it("says which function and where, with the fix", () => {
		const { code } = compileScript(source, { development: true });
		const message = (/new Error\((".*?[^\\]")\)/.exec(code) ?? [])[1];
		expect(JSON.parse(message!)).toMatchSnapshot();
	});

	it("throws when the function is made with a plain function in the capture", () => {
		const { code } = compileScript(source, { development: true });
		const run = (save: unknown): unknown =>
			evaluate(`${code.replace(/export /g, "").replace("function save(n) {}\n", "")}\nreturn f;`, {
				save,
			});
		expect(() => run(() => {})).toThrow(
			/`save` is a plain function, and a main-thread function calls it/,
		);
		// A value that is not a function (a main-thread function's object, a handle) passes.
		expect(run({ _wkltId: "x" })).toMatchObject({ _wkltId: expect.any(String) });
	});

	it("is left out of a production build", () => {
		const { code } = compileScript(source, { development: false });
		expect(code).not.toContain("typeof");
		expect(code).toContain("_c: { save, handler, hold }");
	});

	it("is left out of the main thread, which runs the function", () => {
		const { code } = compileScript(source, { development: true, thread: "main-thread" });
		expect(code).not.toContain("typeof save");
		expect(code).not.toContain("is a plain function");
	});

	it("covers a function in a component, in the instance script", async () => {
		const text = `<script>
			function save(n) {}
			function onTap() { 'main thread'; save(1); }
		</script>
		<view main-thread:ontap={onTap}></view>`;
		const development = await component(text, { development: true });
		expect(development.code).toContain("is a plain function");
		const production = await component(text, { development: false });
		expect(production.code).not.toContain("is a plain function");
		const mainThread = await component(text, { development: true, thread: "main-thread" });
		expect(mainThread.code).not.toContain("is a plain function");
	});

	it("does not fire for a function that is only passed, not called", () => {
		const { code } = compileScript(
			`function save(n) {}\nexport function f() {\n  "main thread";\n  return [save];\n}\n`,
			{ development: true },
		);
		expect(code).not.toContain("typeof");
	});

	it.each([
		["save.call(null, 1)", "call"],
		["save.apply(null, [1])", "apply"],
		["save.bind(null, 1)()", "bind"],
		["save?.call(null)", "optional call"],
	])("covers %s, a call through %s", (call) => {
		const source = `function save(n) {}\nexport function f() {\n  "main thread";\n  ${call};\n}\n`;
		const { code } = compileScript(source, { development: true });
		expect(code).toMatch(/save: typeof save === "function"/);
		expect(compileScript(source, { development: false }).code).not.toContain("typeof");
	});

	it("does not cover a read of the function's own properties", () => {
		const { code } = compileScript(
			`function save(n) {}\nexport function f() {\n  "main thread";\n  return [save.name, save.length];\n}\n`,
			{ development: true },
		);
		expect(code).not.toContain("typeof");
	});

	it("names the file by its path under the app, so two checkouts give one bundle", () => {
		const roots = ["checkout-one", "checkout-two"].map((name) =>
			path.join(APP_ROOT, "tests/fixtures/build", name),
		);
		const [one, two] = roots.map(
			(root) => compileScript(source, { development: true, root, file: "page.ts" }).code,
		);
		expect(one).toBe(two);
		expect(one).toContain("src/page.ts:6:3");
		expect(one).not.toContain(APP_ROOT);
	});
});
