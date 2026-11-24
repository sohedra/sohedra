// `structuredClone`, as HTML § 2.7 serializes: what it refuses, with Node's own as the oracle.

import { describe, expect, it } from "@rstest/core";

import { fillDOMException } from "../../src/fills/web/dom-exception.ts";
import { createStructuredClone } from "../../src/fills/web/structured-clone.ts";

/** A thread with the web's URL classes and `DOMException`, and the fill's `structuredClone`. */
function thread() {
	const scope: Record<string, unknown> = { URL, URLSearchParams, EventTarget };
	fillDOMException(scope);
	return createStructuredClone(scope);
}

/** The name of what `run` throws. */
function thrownName(run: () => unknown): string | undefined {
	try {
		run();
	} catch (error) {
		return (error as Error).name;
	}
	return undefined;
}

describe("structuredClone", () => {
	it.each([
		["a URL", () => new URL("about:blank")],
		["URLSearchParams", () => new URLSearchParams("a=1")],
		["a URL inside an object", () => ({ nested: [new URL("about:blank")] })],
	])("refuses %s with a DataCloneError, as the web's does", (_, make) => {
		expect(thrownName(() => thread()(make()))).toBe("DataCloneError");
		expect(thrownName(() => structuredClone(make()))).toBe("DataCloneError");
	});

	it("refuses an EventTarget in a Map, a platform object HTML doesn't serialize", () => {
		const value = new Map([["k", new EventTarget()]]);
		expect(thrownName(() => thread()(value))).toBe("DataCloneError");
	});

	it("copies plain data, with cycles", () => {
		const value: Record<string, unknown> = { a: [1, "x"], date: new Date(0) };
		value["self"] = value;
		const copy = thread()(value);
		expect(copy).not.toBe(value);
		expect(copy["self"]).toBe(copy);
		expect(copy["a"]).toEqual([1, "x"]);
	});
});
