// The object that stands for a main-thread function reserves `_type` for the runtime: nothing a
// function captures can take the name, because every capture lives under `_c`.

import { describe, expect, it } from "@rstest/core";

import { FUNCTION_FIELDS } from "../../../../src/wire/index.ts";
import { compileScript, component } from "../compiling.ts";
import { readOutput } from "./output.ts";

const source = `const _type = 1, _c = 2, _wkltId = 3, _jsFn = 4;
export function f() {
  "main thread";
  return [_type, _c, _wkltId, _jsFn];
}
`;

describe("the reserved `_type` field", () => {
	it("is named by the wire", () => {
		expect(FUNCTION_FIELDS.type).toBe("_type");
	});

	it("is never written by the build", () => {
		for (const thread of ["background", "main-thread"] as const) {
			const [fn] = readOutput(compileScript(source, { thread }).code).functions;
			expect(fn!.extraKeys).toEqual([]);
			expect(compileScript(source, { thread }).code).not.toMatch(/\b_type:/);
		}
	});

	it("is out of reach of a capture of that name: it stays under `_c`", () => {
		const { code } = compileScript(source);
		expect(code).toContain("_c: { _type, _c, _wkltId, _jsFn }");
		const [fn] = readOutput(code).functions;
		expect(fn!.captures).toEqual(["_type", "_c", "_wkltId", "_jsFn"]);
	});

	it("holds in a component, on both threads", async () => {
		const text = `<script>
			const _type = 1;
			function tap() { 'main thread'; return _type; }
		</script>
		<view main-thread:ontap={tap}></view>`;
		for (const thread of ["background", "main-thread"] as const) {
			const { code } = await component(text, { thread });
			expect(code).toMatch(/_c: \{\s*_type\s*\}/);
			const [fn] = readOutput(code).functions;
			expect(fn!.extraKeys).toEqual([]);
		}
	});
});
