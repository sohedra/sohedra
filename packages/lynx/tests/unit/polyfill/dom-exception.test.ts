// `DOMException`, against Web IDL § 2.8.1, with Node's own (which passes the web platform tests) as
// the reference for names, codes, constants and the shape of the interface.

import { describe, expect, it } from "@rstest/core";

import {
	DOMException as Fill,
	domException,
	fillDOMException,
} from "../../../src/polyfill/web/dom-exception.ts";

const NAMES = [
	"IndexSizeError",
	"HierarchyRequestError",
	"WrongDocumentError",
	"InvalidCharacterError",
	"NoModificationAllowedError",
	"NotFoundError",
	"NotSupportedError",
	"InUseAttributeError",
	"InvalidStateError",
	"SyntaxError",
	"InvalidModificationError",
	"NamespaceError",
	"InvalidAccessError",
	"TypeMismatchError",
	"SecurityError",
	"NetworkError",
	"AbortError",
	"URLMismatchError",
	"QuotaExceededError",
	"TimeoutError",
	"InvalidNodeTypeError",
	"DataCloneError",
	"EncodingError",
	"NotReadableError",
	"OperationError",
	"Error",
	"anything",
];

describe("DOMException", () => {
	it.each(NAMES)("gives %s the code Node's gives it", (name) => {
		const error = new Fill("text", name);
		expect(error.name).toBe(name);
		expect(error.message).toBe("text");
		expect(error.code).toBe(new DOMException("text", name).code);
	});

	it("defaults to an empty message and the name Error, and makes its arguments text", () => {
		const error = new Fill();
		expect([error.name, error.message, error.code]).toEqual(["Error", "", 0]);
		const made = new Fill(12, null);
		expect([made.message, made.name]).toEqual(["12", "null"]);
	});

	it("is an Error, tagged and named as Node's", () => {
		const error = new Fill("m", "AbortError");
		expect(error).toBeInstanceOf(Error);
		expect(Object.prototype.toString.call(error)).toBe(
			Object.prototype.toString.call(new DOMException("m", "AbortError")),
		);
		expect(Fill.name).toBe("DOMException");
		expect(String(error)).toBe(String(new DOMException("m", "AbortError")));
		expect(typeof error.stack).toBe("string");
	});

	it("has every legacy constant Node's has, on the class and its prototype, as Web IDL defines them", () => {
		const constants = Object.getOwnPropertyNames(DOMException).filter((key) =>
			key.endsWith("_ERR"),
		);
		expect(constants.length).toBe(25);
		for (const key of constants) {
			expect(Object.getOwnPropertyDescriptor(Fill, key), key).toEqual(
				Object.getOwnPropertyDescriptor(DOMException, key),
			);
			expect(Object.getOwnPropertyDescriptor(Fill.prototype, key), key).toEqual(
				Object.getOwnPropertyDescriptor(DOMException.prototype, key),
			);
		}
	});

	it("has name, message and code as enumerable getters of its prototype, not own properties", () => {
		const error = new Fill("m", "AbortError");
		expect(Object.keys(error)).toEqual([]);
		for (const key of ["name", "message", "code"]) {
			const descriptor = Object.getOwnPropertyDescriptor(Fill.prototype, key)!;
			expect(typeof descriptor.get, key).toBe("function");
			expect(descriptor.enumerable, key).toBe(true);
			expect(() => descriptor.get!.call({}), key).toThrow(TypeError);
		}
	});
});

describe("domException", () => {
	it("makes one of the thread's own class when it has one, else the fill's", () => {
		expect(domException({ DOMException }, "m", "AbortError")).toBeInstanceOf(DOMException);
		const made = domException({}, "m", "AbortError");
		expect(made).toBeInstanceOf(Fill);
		expect(made.name).toBe("AbortError");
	});
});

describe("the fill", () => {
	it("puts it on a thread that lacks it, not enumerable, and leaves a thread's own", () => {
		const scope: Record<string, unknown> = {};
		fillDOMException(scope);
		expect(scope["DOMException"]).toBe(Fill);
		expect(Object.keys(scope)).toEqual([]);
		const own: Record<string, unknown> = { DOMException };
		fillDOMException(own);
		expect(own["DOMException"]).toBe(DOMException);
	});
});
