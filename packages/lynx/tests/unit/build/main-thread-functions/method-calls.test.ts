// A method called through a captured object captures the object: the method needs its `this`,
// and a plain function cannot be sent to the main thread.

import { describe, expect, it } from "@rstest/core";

import { compileScript } from "../compiling.ts";
import { evaluate, readOutput, registrationBodies } from "./output.ts";

const captures = (source: string): string[][] =>
	readOutput(compileScript(source).code).functions.map((fn) => fn.captures);

const body = (calls: string, declarations = "const hold = { spring: { set() {} }, value: 1 };") =>
	`${declarations}\nexport function f() {\n  "main thread";\n  ${calls}\n}\n`;

describe("a method call through a captured object", () => {
	it("captures the object the method is called on, not the method", () => {
		expect(captures(body("hold.spring.set(2);"))).toEqual([["hold.spring"]]);
		expect(compileScript(body("hold.spring.set(2);")).code).toContain(
			"_c: { hold: { spring: hold.spring } }",
		);
		expect(compileScript(body("hold.spring.set(2);")).code).not.toContain("hold.spring.set");
	});

	it("captures the object itself for a method of the first level", () => {
		expect(captures(body("hold.reset();"))).toEqual([["hold"]]);
	});

	it("keeps going down the path to the object, whatever the depth", () => {
		expect(captures(body("a.b.c.d.run();", "const a = { b: { c: { d: {} } } };"))).toEqual([
			["a.b.c.d"],
		]);
	});

	it("takes a computed or optional method call to the object before it", () => {
		expect(captures(body("hold.spring?.set(2);"))).toEqual([["hold.spring"]]);
		expect(captures(body("hold.spring['set'](2);"))).toEqual([["hold.spring"]]);
		expect(captures(body("hold?.spring.set(2);"))).toEqual([["hold"]]);
	});

	it("merges with what the body reads of the same object", () => {
		expect(captures(body("hold.spring.set(hold.value);"))).toEqual([["hold.spring", "hold.value"]]);
		// The object itself is captured whole, so a member of it adds nothing.
		expect(captures(body("hold.spring.set(hold.spring.target);"))).toEqual([["hold.spring"]]);
	});

	it("leaves a method of a global alone, and a plain call of a captured function as a capture", () => {
		expect(captures(body("Math.max(1, 2); console.log(1);"))).toEqual([[]]);
		expect(captures(body("run(1);", "const run = () => {};"))).toEqual([["run"]]);
	});

	it("runs the method on the object on the main thread", () => {
		const setup =
			"const calls = [];\nconst hold = { spring: { set(n) { calls.push([this === hold.spring, n]); } } };";
		const source = `${setup}\nexport function f() {\n  "main thread";\n  hold.spring.set(2);\n}\n`;
		const { code } = compileScript(source, { thread: "main-thread" });
		const calls = evaluate(
			`${code.slice(0, code.indexOf("\nimport {")).replace("export ", "")}
			 let body;
			 const registerWorkletInternal = (_, __, fn) => (body = fn);
			 ${registrationBodies(code)}
			 body.call(f);
			 return calls;`,
		);
		expect(calls).toEqual([[true, 2]]);
	});
});
