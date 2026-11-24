// A page's error that reads a global Lynx lacks names what fills it, or what to use instead.

import { describe, expect, it } from "@rstest/core";

import { engineHas, globalGap, withMissingGlobalHint } from "../../../src/wire/index.ts";

/** The engine's error for reading `name`, as V8 and PrimJS write it. */
const notDefined = (name: string): ReferenceError => new ReferenceError(`${name} is not defined`);

describe("an error for a global Lynx lacks", () => {
	it("names the import of the fill that gives it", () => {
		const original = notDefined("URL");
		const hinted = withMissingGlobalHint(original, "background") as ReferenceError;
		expect(hinted).toBeInstanceOf(ReferenceError);
		expect(hinted.message.split("\n")[0]).toBe(
			"The global `URL` is not defined: Lynx's engine doesn't have it, and no import put it there.",
		);
		expect(hinted.message).toContain('Import "@sohedra/lynx-polyfill/url"');
		expect(hinted.cause).toBe(original);
	});

	it("names it under Svelte's lines, which a development build adds to the message", () => {
		const original = new ReferenceError("URL is not defined\n\n\tin <App>\n");
		const hinted = withMissingGlobalHint(original, "background") as Error;
		expect(hinted.message).toContain('Import "@sohedra/lynx-polyfill/url"');
		expect(hinted.cause).toBe(original);
	});

	it("names the catch-all import for the global object's own names", () => {
		const hinted = withMissingGlobalHint(
			new ReferenceError("navigator is not defined"),
			"background",
		) as Error;
		expect(hinted.message).toContain('Import "@sohedra/lynx-polyfill" in the first line');
	});

	it("names only the subpath for a global the catch-all import leaves out", () => {
		const hinted = withMissingGlobalHint(notDefined("URLPattern"), "background") as Error;
		expect(hinted.message).toContain(
			'Import "@sohedra/lynx-polyfill/url-pattern" in the first line',
		);
		expect(hinted.message).not.toContain('or "@sohedra/lynx-polyfill"');
	});

	it("reads JavaScriptCore's wording too", () => {
		const hinted = withMissingGlobalHint(
			new ReferenceError("Can't find variable: TextEncoder"),
			"background",
		) as Error;
		expect(hinted.message).toContain('"@sohedra/lynx-polyfill/encoding"');
	});

	it.each(["crypto", "Intl", "WebAssembly", "WebSocket", "matchMedia", "localStorage"])(
		"says what to use instead of %s, which no fill gives",
		(name) => {
			const hinted = withMissingGlobalHint(
				new ReferenceError(`${name} is not defined`),
				"main-thread",
			) as Error;
			expect(hinted.message.split("\n")[0]).toBe(
				`The global \`${name}\` is not defined: Lynx's engine doesn't have it, and no fill gives it.`,
			);
			expect(hinted.message).toContain("https://sohedra.com/e/global_not_on_lynx");
		},
	);

	it.each([
		"ReadableStreamDefaultController",
		"ReadableByteStreamController",
		"ReadableStreamBYOBRequest",
		"WritableStreamDefaultController",
		"TransformStreamDefaultController",
	])("names the streams import for %s", (name) => {
		const hinted = withMissingGlobalHint(notDefined(name), "background") as Error;
		expect(hinted.message).toContain('Import "@sohedra/lynx-polyfill/streams"');
	});

	it("names the import for structuredClone and queueMicrotask", () => {
		const clone = withMissingGlobalHint(notDefined("structuredClone"), "main-thread") as Error;
		expect(clone.message).toContain('Import "@sohedra/lynx-polyfill/structured-clone"');
		const microtask = withMissingGlobalHint(notDefined("queueMicrotask"), "main-thread") as Error;
		expect(microtask.message).toContain('Import "@sohedra/lynx-polyfill" in the first line');
	});

	it.each([
		"ReadableStream",
		"TextEncoderStream",
		"Blob",
		"FormData",
		"EventSource",
		"CompressionStream",
	])("says %s runs on the background only, when the main thread reads it", (name) => {
		const hinted = withMissingGlobalHint(notDefined(name), "main-thread") as Error;
		expect(hinted.message.split("\n")[0]).toBe(
			`The global \`${name}\` is not defined on the main thread: Lynx has it on the background thread only.`,
		);
		expect(hinted.message).toContain("runOnBackground");
		expect(hinted.message).toContain("https://sohedra.com/e/global_background_only");
		const background = withMissingGlobalHint(notDefined(name), "background") as Error;
		expect(background.message).toContain('Import "@sohedra/lynx-polyfill/');
	});

	it("names the import for a name both threads get, on the main thread", () => {
		const hinted = withMissingGlobalHint(notDefined("Headers"), "main-thread") as Error;
		expect(hinted.message).toContain('Import "@sohedra/lynx-polyfill/fetch"');
	});

	it.each([
		["URL", "background", "global_not_filled"],
		["crypto", "background", "global_not_on_lynx"],
		["ReadableStream", "main-thread", "global_background_only"],
	] as const)(
		"carries the code of its message for %s on the %s, as onError's context gives it",
		(name, thread, code) => {
			const hinted = withMissingGlobalHint(notDefined(name), thread) as Error & { code?: unknown };
			expect(hinted.code).toBe(code);
			expect(hinted.message).toContain(`https://sohedra.com/e/${code}`);
		},
	);

	it("keeps the original's stack frames", () => {
		const original = new ReferenceError("Blob is not defined");
		original.stack = "ReferenceError: Blob is not defined\n    at page (app.js:1:2)";
		const hinted = withMissingGlobalHint(original, "background") as Error;
		expect(hinted.stack).toMatch(/^ReferenceError: The global `Blob`/);
		expect(hinted.stack).toMatch(/\n {4}at page \(app\.js:1:2\)$/);
	});
});

describe("any other error", () => {
	it.each([
		["a name no fill gives", new ReferenceError("myHelper is not defined")],
		["another ReferenceError", new ReferenceError("Cannot access 'x' before initialization")],
		["a name of an object's own", new ReferenceError("constructor is not defined")],
		["another kind of error", new TypeError("URL is not defined")],
		["a value that is not an error", "URL is not defined"],
	])("is left as it is: %s", (_, error) => {
		expect(withMissingGlobalHint(error, "background")).toBe(error);
	});
});

describe("the table the build reads", () => {
	it("gives a global's fill, and whether the catch-all import gives it too", () => {
		expect(globalGap("TextEncoder", "background")).toEqual({
			kind: "fill",
			module: "@sohedra/lynx-polyfill/encoding",
			baseline: true,
		});
		expect(globalGap("EventSource", "background")).toEqual({
			kind: "fill",
			module: "@sohedra/lynx-polyfill/event-source",
			baseline: false,
		});
	});

	it("says what no fill gives, and what only the background gets", () => {
		expect(globalGap("Intl", "background")?.kind).toBe("not_on_lynx");
		expect(globalGap("Blob", "main-thread")).toEqual({ kind: "background_only" });
	});

	it("names no global it doesn't know, nor one of an object's own names", () => {
		expect(globalGap("myHelper", "background")).toBeUndefined();
		expect(globalGap("constructor", "background")).toBeUndefined();
		expect(globalGap("toString", "main-thread")).toBeUndefined();
	});

	it("says which of the fills' globals a thread has without the package", () => {
		expect(engineHas("URL", "background")).toBe(true);
		expect(engineHas("URL", "main-thread")).toBe(false);
		expect(engineHas("TextEncoder", "background")).toBe(false);
		expect(engineHas("structuredClone", "main-thread")).toBe(true);
	});
});
