// `atob` and `btoa`: HTML § 8.3 "Base64 utility methods", over Infra's forgiving-base64 decode and
// encode. Both threads lack them (PrimJS, lynx-core). Leaves out nothing.

import type { Scope } from "../globals.ts";
import { holds, installLazy } from "../install.ts";
import { domException } from "./dom-exception.ts";

/** @workaround web-atob kind=lynx-gap delete-when="the engine of the oldest Lynx the package supports has atob and btoa on both threads" */
export function fillAtob(scope: Scope): void {
	installLazy(
		scope,
		"atob",
		() => createAtob(scope),
		works((atob) => atob(" Y\tQ==\n") === "a" && atob("YQ") === "a"),
	);
	installLazy(
		scope,
		"btoa",
		() => createBtoa(scope),
		works((btoa) => btoa("\xff") === "/w=="),
	);
}

/** A check that what is there is a function that gets `probe` right. */
function works(probe: (fn: (data: string) => string) => boolean) {
	return (existing: unknown): boolean =>
		typeof existing === "function" &&
		// Boundary: the global, which the check calls as the standard one.
		holds(() => probe(existing as (data: string) => string));
}

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

/** Each character code's value in the alphabet, or -1. */
const VALUES: Int16Array = (() => {
	const values = new Int16Array(128).fill(-1);
	for (let index = 0; index < ALPHABET.length; index++) values[ALPHABET.charCodeAt(index)] = index;
	return values;
})();

/** ASCII whitespace, as Infra defines it: tab, line feed, form feed, carriage return, space. */
const WHITESPACE = /[\t\n\f\r ]/g;

/** The `InvalidCharacterError` `DOMException` the standard throws. */
function invalidCharacter(scope: Scope, message: string): Error {
	return domException(scope, message, "InvalidCharacterError");
}

/** WebIDL's `DOMString` of an argument: a symbol is refused, anything else made text. */
function domString(name: string, args: unknown[]): string {
	if (args.length === 0) throw new TypeError(`${name} takes 1 argument, and none was given.`);
	const value = args[0];
	if (typeof value === "symbol") throw new TypeError(`${name} can't convert a Symbol to a string.`);
	return `${value as string}`;
}

/** `atob`: decodes forgiving base64 into a string of bytes. */
export function createAtob(scope: Scope): (data: string) => string {
	return function atob(...args: unknown[]): string {
		let data = domString("atob", args).replace(WHITESPACE, "");
		if (data.length % 4 === 0) data = data.replace(/==?$/, "");
		const fail = (): Error =>
			invalidCharacter(scope, "atob was given a string that is not correctly encoded base64.");
		if (data.length % 4 === 1) throw fail();
		let output = "";
		let buffer = 0;
		let bits = 0;
		for (let index = 0; index < data.length; index++) {
			const code = data.charCodeAt(index);
			const value = code < 128 ? VALUES[code]! : -1;
			if (value === -1) throw fail();
			buffer = (buffer << 6) | value;
			bits += 6;
			if (bits >= 8) {
				bits -= 8;
				output += String.fromCharCode((buffer >> bits) & 0xff);
			}
		}
		return output;
	};
}

/** `btoa`: encodes a string of bytes as base64. */
export function createBtoa(scope: Scope): (data: string) => string {
	return function btoa(...args: unknown[]): string {
		const data = domString("btoa", args);
		let output = "";
		for (let index = 0; index < data.length; index += 3) {
			const first = data.charCodeAt(index);
			const second = index + 1 < data.length ? data.charCodeAt(index + 1) : 0;
			const third = index + 2 < data.length ? data.charCodeAt(index + 2) : 0;
			if (first > 0xff || second > 0xff || third > 0xff)
				throw invalidCharacter(scope, "btoa was given a character outside Latin-1.");
			const group = (first << 16) | (second << 8) | third;
			output +=
				ALPHABET[(group >> 18) & 63]! +
				ALPHABET[(group >> 12) & 63]! +
				(index + 1 < data.length ? ALPHABET[(group >> 6) & 63]! : "=") +
				(index + 2 < data.length ? ALPHABET[group & 63]! : "=");
		}
		return output;
	};
}
