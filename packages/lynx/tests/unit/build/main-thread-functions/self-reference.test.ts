// A main-thread function that refers to itself by the name it is declared with, as an animation
// loop does: `const tick = () => { 'main thread'; requestAnimationFrame(tick); }`. The name is not
// captured (the object would read itself before it exists); on the main thread it is the
// registered body, bound to the same object, as for a function declaration.

import { describe, expect, it } from "@rstest/core";

import { compileScript, component } from "../compiling.ts";
import { evaluate, readOutput, runAcross } from "./output.ts";

/** Makes the module's function on the background, and runs its registered body with `args`. */
function run(source: string, name: string, ...args: unknown[]): unknown {
	const background = compileScript(source, { thread: "background" }).code;
	const mainThread = compileScript(source, { thread: "main-thread" }).code;
	return runAcross({ background, mainThread }, name, ...args);
}

describe("a main-thread function that refers to itself", () => {
	it.each([
		["a const arrow", "export const count = (n) => {"],
		["a let arrow", "export let count = (n) => {"],
		["a const function expression", "export const count = function (n) {"],
	])("compiles and runs as %s", (_, opening) => {
		const source = `const limit = 3;\n${opening}\n  "main thread";\n  return n < limit ? count(n + 1) : n;\n};\n`;
		expect(readOutput(compileScript(source).code).functions.map((fn) => fn.captures)).toEqual([
			["limit"],
		]);
		expect(run(source, "count", 0)).toBe(3);
	});

	it("loads in a module that reads it at once, as the animation loop does", () => {
		const source = `const frames = [];\nexport const tick = () => {\n  "main thread";\n  frames.push(tick);\n};\n`;
		const background = compileScript(source).code;
		expect(() => evaluate(`${background.replace(/export /g, "")}\nreturn tick;`)).not.toThrow();
	});

	it("is the registered body, bound to the same object, under both names of a named expression", () => {
		const source = `export const outer = function inner(n) {\n  "main thread";\n  return n > 0 ? outer(n - 1) + inner(n - 1) : 1;\n};\n`;
		expect(readOutput(compileScript(source).code).functions[0]!.captures).toEqual([]);
		expect(run(source, "outer", 3)).toBe(8);
	});

	it("is a capture again where the body declares the name for itself", () => {
		const source = `const other = 1;\nexport const tick = () => {\n  "main thread";\n  const tick = other;\n  return tick;\n};\n`;
		expect(readOutput(compileScript(source).code).functions[0]!.captures).toEqual(["other"]);
	});

	it("compiles in a component without deriving from itself", async () => {
		const source = `<script>
	let x = $state(1);
	const tick = () => {
		'main thread';
		console.log(x);
		requestAnimationFrame(tick);
	};
</script>
<view main-thread:ontap={tick}></view>`;
		for (const thread of ["background", "main-thread"] as const) {
			const { code } = await component(source, { thread, development: true });
			expect(readOutput(code).functions.map((fn) => fn.captures)).toEqual([["x"]]);
		}
	});
});
