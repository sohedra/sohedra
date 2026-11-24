// test262's harness in a thread's realm: the host's `$262` (INTERPRETING.md), and the line from the
// test to the driver (driver.ts). Runs in PrimJS, after the thread's fills.

import type { Thread } from "../../../src/fills/globals.ts";
import { describe, report } from "../realm.ts";

declare function load(path: string): unknown;
declare function evalScript(text: string): unknown;
declare function detachArrayBuffer(buffer: ArrayBuffer): void;

/** How the driver runs a test: its scripts in order, and the error it must throw. */
interface Run {
	scripts: string[];
	negative: { phase: string; type: string } | null;
}

/** The name of an error's constructor, as test262 names a negative test's error. */
function errorType(error: unknown): string {
	if (typeof error !== "object" || error === null) return typeof error;
	// Boundary: any thrown object; test262 compares the constructor's name.
	const constructor = (error as { constructor?: { name?: unknown } }).constructor;
	return typeof constructor?.name === "string" ? constructor.name : "Object";
}

/** Gives the realm `$262` and the driver's script `test262Driver`. */
export function connectTest262(thread: Thread): void {
	// Boundary: the realm's global object.
	const scope = globalThis as unknown as Record<string, unknown>;
	// What this host gives of `$262`: no other realms, agents or garbage collection, which the
	// tests that need them name in their features (features.json).
	scope["$262"] = {
		global: globalThis,
		evalScript,
		detachArrayBuffer,
	};
	const driver = {
		thread,
		/** Runs a test's scripts, and tells the driver whether it threw what it should. */
		run({ scripts, negative }: Run): void {
			let thrown: { error: unknown } | undefined;
			// By index: the test, the last script, may replace what a for…of calls.
			for (let index = 0; index < scripts.length; index++) {
				try {
					load(scripts[index]!);
				} catch (error) {
					thrown = { error };
					break;
				}
			}
			if (negative === null) {
				report(
					thrown
						? { type: "result", passed: false, message: describe(thrown.error) }
						: { type: "result", passed: true },
				);
				return;
			}
			if (!thrown) {
				report({ type: "result", passed: false, message: `expected a ${negative.type}, got none` });
				return;
			}
			const type = errorType(thrown.error);
			report(
				type === negative.type
					? { type: "result", passed: true }
					: {
							type: "result",
							passed: false,
							message: `expected a ${negative.type}, got ${describe(thrown.error)}`,
						},
			);
		},
	};
	Object.defineProperty(scope, "test262Driver", {
		value: driver,
		configurable: true,
		writable: true,
	});
}
