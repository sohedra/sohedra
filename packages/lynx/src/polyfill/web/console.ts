// `console.trace` and `console.assert`: the Console Standard § 1.1 "Logging functions". The
// background lacks `trace`, the main thread both. `trace` logs its arguments and the stack at the
// log level; `assert` logs at the error level, as the standard's Logger prints them.

import type { ThreadConsole } from "../globals.ts";
import { installEager } from "../install.ts";

/** @workaround web-console-trace-assert kind=lynx-gap delete-when="Lynx's threads have console.trace and console.assert" */
export function fillConsole(console: ThreadConsole): void {
	installEager(console, "trace", function trace(...data: unknown[]): void {
		const lines = `${new Error().stack ?? ""}`.split("\n");
		// V8 heads the stack with the error's text, PrimJS does not; then the first frame is this one.
		if (lines[0]?.startsWith("Error")) lines.shift();
		const stack = lines.slice(1).join("\n");
		console.log("Trace:", ...data, ...(stack ? [`\n${stack}`] : []));
	});
	installEager(console, "assert", function assert(condition?: unknown, ...data: unknown[]): void {
		if (condition) return;
		if (typeof data[0] === "string") data[0] = `Assertion failed: ${data[0]}`;
		else data.unshift("Assertion failed");
		console.error(...data);
	});
}
