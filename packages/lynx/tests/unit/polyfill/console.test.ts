// `console.trace` and `console.assert`, as the Console Standard § 1.1 prints them, through the
// thread's own `log` and `error`.

import { describe, expect, it } from "@rstest/core";

import type { ThreadConsole } from "../../../src/polyfill/globals.ts";
import { fillConsole } from "../../../src/polyfill/web/console.ts";

/** A thread's console without trace and assert, which records what it prints. */
function recorded() {
	const printed: [string, unknown[]][] = [];
	const console: ThreadConsole & {
		trace?: (...data: unknown[]) => void;
		assert?: (...data: unknown[]) => void;
	} = {
		log: (...data) => void printed.push(["log", data]),
		error: (...data) => void printed.push(["error", data]),
		warn: (...data) => void printed.push(["warn", data]),
	};
	fillConsole(console);
	return { console, printed };
}

describe("console.trace", () => {
	it("logs its arguments after Trace:, then the stack, without trace's own frame", () => {
		const { console, printed } = recorded();
		console.trace!("here", 1);
		const [[level, data]] = printed as [[string, unknown[]]];
		expect(level).toBe("log");
		expect(data.slice(0, 3)).toEqual(["Trace:", "here", 1]);
		const stack = data[3] as string;
		expect(stack.startsWith("\n")).toBe(true);
		expect(stack).not.toMatch(/^\s*Error/);
		expect(stack).not.toMatch(/at trace /);
		expect(stack).toMatch(/console\.test\.ts/);
	});
});

describe("console.assert", () => {
	it("prints nothing when the condition holds", () => {
		const { console, printed } = recorded();
		console.assert!(true, "never");
		expect(printed).toEqual([]);
	});

	it("prints at the error level, the message prefixed, or the standard's words before other data", () => {
		const { console, printed } = recorded();
		console.assert!(false, "went %s", "wrong");
		console.assert!(0, { a: 1 });
		console.assert!(false);
		expect(printed).toEqual([
			["error", ["Assertion failed: went %s", "wrong"]],
			["error", ["Assertion failed", { a: 1 }]],
			["error", ["Assertion failed"]],
		]);
	});
});

describe("the fill", () => {
	it("leaves a console's own", () => {
		const trace = () => {};
		const assert = () => {};
		const console = { log() {}, error() {}, warn() {}, trace, assert };
		fillConsole(console);
		expect([console.trace, console.assert]).toEqual([trace, assert]);
	});
});
