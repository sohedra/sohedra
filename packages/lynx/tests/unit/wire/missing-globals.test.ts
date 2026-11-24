// A page's error that reads a global Lynx lacks names what fills it, or what to use instead.

import { describe, expect, it } from "@rstest/core";

import { withMissingGlobalHint } from "../../../src/wire/index.ts";

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

	it("names the catch-all import for the global object's own names", () => {
		const hinted = withMissingGlobalHint(
			new ReferenceError("navigator is not defined"),
			"background",
		) as Error;
		expect(hinted.message).toContain('Import "@sohedra/lynx-polyfill" in the first line');
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
		["another kind of error", new TypeError("URL is not defined")],
		["a value that is not an error", "URL is not defined"],
	])("is left as it is: %s", (_, error) => {
		expect(withMissingGlobalHint(error, "background")).toBe(error);
	});
});
