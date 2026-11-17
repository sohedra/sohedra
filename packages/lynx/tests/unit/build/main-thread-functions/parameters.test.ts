// A parameter's default value runs before the body: on the main thread, the names it reads from
// the captures are unpacked before it runs.

import { describe, expect, it } from "@rstest/core";

import { compileScript } from "../compiling.ts";
import { registrationsOf, runAcross } from "./output.ts";

/** Runs the module's function `f` across the threads with `args`. */
function run(source: string, ...args: unknown[]): unknown {
	const background = compileScript(source, { thread: "background" }).code;
	const mainThread = compileScript(source, { thread: "main-thread" }).code;
	return runAcross({ background, mainThread }, "f", ...args);
}

describe("a default parameter of a main-thread function", () => {
	it("reads a captured name", () => {
		const source = `let scale = 2;\nexport const f = (value, by = scale) => {\n  "main thread";\n  return value * by;\n};\n`;
		expect(run(source, 3)).toBe(6);
		expect(run(source, 3, 5)).toBe(15);
	});

	it("reads a captured name in a destructured default", () => {
		const source = `const fallback = { ratio: 4 };\nexport function f(value, { ratio = fallback.ratio } = {}) {\n  "main thread";\n  return value * ratio;\n}\n`;
		expect(run(source, 2)).toBe(8);
		expect(run(source, 2, { ratio: 3 })).toBe(6);
	});

	it("reads the function itself", () => {
		const source = `export const f = (n, again = f) => {\n  "main thread";\n  return n > 0 ? again(n - 1) + 1 : 0;\n};\n`;
		expect(run(source, 3)).toBe(3);
	});

	it("keeps the arguments and an async body", async () => {
		const source = `const base = 1;\nexport const f = async (a = base, ...rest) => {\n  "main thread";\n  return [a, rest.length];\n};\n`;
		expect(await run(source)).toEqual([1, 0]);
		expect(await run(source, 5, 6, 7)).toEqual([5, 2]);
	});

	it("leaves a function whose parameters read no capture as written", () => {
		const source = `const scale = 2;\nexport const f = (value, by = 3) => {\n  "main thread";\n  return value * by * scale;\n};\n`;
		expect(registrationsOf(compileScript(source, { thread: "main-thread" }).code)).toContain(
			'function (value, by = 3) {\nlet { scale } = this["_c"];',
		);
		expect(run(source, 1)).toBe(6);
	});
});
