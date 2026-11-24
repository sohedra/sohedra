// `TextEncoder` and `TextDecoder`: the Encoding Standard § 8.1 "Interface TextDecoder", § 8.2
// "Interface TextEncoder", with § 9.1 UTF-8's decoder and encoder. Both threads lack them (lynx-core
// has classes of these names, not on the global object, that decode no more than valid UTF-8).
// UTF-8 only, as WinterTC asks: another label is a `RangeError`. With `fatal`, `ignoreBOM` and
// `stream`. On the background, where lynx-core gives `TextCodecHelper`, its native code encodes and
// decodes what is well formed, once it has shown it gets a sample right; the rest is decoded here.

import type { Scope } from "../globals.ts";
import { holds, installLazy, named } from "../install.ts";
import type { TextDecoderClass, TextEncoderClass } from "./standard-classes.ts";

/** @workaround web-text-encoding kind=lynx-gap delete-when="Lynx's threads have global TextEncoder and TextDecoder" */
export function fillTextEncoding(scope: Scope): void {
	const { TextEncoder, TextDecoder } = createTextEncoding(scope);
	installLazy(scope, "TextEncoder", () => TextEncoder, encodes);
	installLazy(scope, "TextDecoder", () => TextDecoder, decodes);
}

const encodes = (existing: unknown): boolean =>
	typeof existing === "function" &&
	// Boundary: the thread's own, checked as the standard one.
	holds(() => new (existing as TextEncoderClass)().encode("€").length === 3);

const decodes = (existing: unknown): boolean =>
	typeof existing === "function" &&
	holds(
		() =>
			// Boundary: the thread's own, checked as the standard one.
			new (existing as TextDecoderClass)("utf-8", { fatal: true }).decode(
				new Uint8Array([0xe2, 0x82, 0xac]),
			) === "€",
	);

/** lynx-core's native codec (types/background-thread/text-encoder-decoder.d.ts, Lynx 3.4). */
interface TextCodecHelper {
	decode(input: ArrayBuffer): string;
	encode(input: string): ArrayBuffer;
}

const SAMPLE = "a\0é\uFEFF€😀";
const SAMPLE_BYTES = [
	0x61, 0, 0xc3, 0xa9, 0xef, 0xbb, 0xbf, 0xe2, 0x82, 0xac, 0xf0, 0x9f, 0x98, 0x80,
];

/** The thread's `TextCodecHelper`, when it has one that gets the sample right both ways. */
function nativeCodec(scope: Scope): TextCodecHelper | undefined {
	// Boundary: lynx-core's background global, which the main thread lacks.
	const helper = scope["TextCodecHelper"] as TextCodecHelper | undefined;
	if (typeof helper !== "object" || helper === null) return undefined;
	return holds(() => {
		const bytes = new Uint8Array(helper.encode(SAMPLE));
		return (
			helper.decode(new Uint8Array(SAMPLE_BYTES).buffer) === SAMPLE &&
			bytes.length === SAMPLE_BYTES.length &&
			bytes.every((byte, index) => byte === SAMPLE_BYTES[index])
		);
	})
		? helper
		: undefined;
}

/** The labels of UTF-8 (§ 4.2 "Names and labels"). */
const UTF8_LABELS = [
	"unicode-1-1-utf-8",
	"unicode11utf8",
	"unicode20utf8",
	"utf-8",
	"utf8",
	"x-unicode20utf8",
];

/** A lone surrogate, which UTF-8 can't hold. */
const LONE_SURROGATE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?:^|[^\uD800-\uDBFF])[\uDC00-\uDFFF]/;

/** Bytes of a `BufferSource`, as a view (no copy); `TypeError` for anything else. */
export function bytesOf(input: unknown, what: string): Uint8Array {
	if (input instanceof ArrayBuffer) return new Uint8Array(input);
	if (ArrayBuffer.isView(input))
		return new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
	if (typeof SharedArrayBuffer === "function" && input instanceof SharedArrayBuffer)
		return new Uint8Array(input);
	throw new TypeError(`${what} takes an ArrayBuffer or a view of one.`);
}

/** UTF-8's encoder, in JavaScript: each lone surrogate is U+FFFD. */
function encodeInScript(input: string): Uint8Array {
	const out = new Uint8Array(input.length * 3);
	let size = 0;
	for (let index = 0; index < input.length; index++) {
		let code = input.charCodeAt(index);
		if (code >= 0xd800 && code <= 0xdfff) {
			const next = input.charCodeAt(index + 1);
			if (code <= 0xdbff && next >= 0xdc00 && next <= 0xdfff) {
				code = 0x10000 + ((code - 0xd800) << 10) + (next - 0xdc00);
				index++;
			} else code = 0xfffd;
		}
		size = writeCodePoint(out, size, code);
	}
	return out.slice(0, size);
}

/** Writes `code` at `at` as UTF-8, and answers where the next byte goes. */
function writeCodePoint(out: Uint8Array, at: number, code: number): number {
	if (code < 0x80) {
		out[at] = code;
		return at + 1;
	}
	if (code < 0x800) {
		out[at] = 0xc0 | (code >> 6);
		out[at + 1] = 0x80 | (code & 0x3f);
		return at + 2;
	}
	if (code < 0x10000) {
		out[at] = 0xe0 | (code >> 12);
		out[at + 1] = 0x80 | ((code >> 6) & 0x3f);
		out[at + 2] = 0x80 | (code & 0x3f);
		return at + 3;
	}
	out[at] = 0xf0 | (code >> 18);
	out[at + 1] = 0x80 | ((code >> 12) & 0x3f);
	out[at + 2] = 0x80 | ((code >> 6) & 0x3f);
	out[at + 3] = 0x80 | (code & 0x3f);
	return at + 4;
}

/** How many bytes of `bytes`, from the start, are whole and well-formed UTF-8. */
function wellFormedLength(bytes: Uint8Array): number {
	let index = 0;
	while (index < bytes.length) {
		const byte = bytes[index]!;
		if (byte < 0x80) {
			index++;
			continue;
		}
		const [needed, lower, upper] = leadOf(byte);
		if (needed === 0 || index + needed >= bytes.length) return index;
		const second = bytes[index + 1]!;
		if (second < lower || second > upper) return index;
		for (let next = 2; next <= needed; next++)
			if ((bytes[index + next]! & 0xc0) !== 0x80) return index;
		index += needed + 1;
	}
	return index;
}

/** For a lead byte: how many bytes follow it, and the range of the first of them (0 if not a lead). */
function leadOf(byte: number): [needed: number, lower: number, upper: number] {
	if (byte >= 0xc2 && byte <= 0xdf) return [1, 0x80, 0xbf];
	if (byte >= 0xe0 && byte <= 0xef)
		return [2, byte === 0xe0 ? 0xa0 : 0x80, byte === 0xed ? 0x9f : 0xbf];
	if (byte >= 0xf0 && byte <= 0xf4)
		return [3, byte === 0xf0 ? 0x90 : 0x80, byte === 0xf4 ? 0x8f : 0xbf];
	return [0, 0, 0];
}

/** Code units made text, in slices an engine's argument list can take. */
function textOf(units: number[]): string {
	let text = "";
	for (let start = 0; start < units.length; start += 8192)
		text += String.fromCharCode.apply(null, units.slice(start, start + 8192));
	return text;
}

/** The thread's `TextEncoder` and `TextDecoder`, over its native codec when it has one. */
export function createTextEncoding(scope: Scope): {
	TextEncoder: TextEncoderClass;
	TextDecoder: TextDecoderClass;
} {
	let codec: TextCodecHelper | undefined | null = null;
	const native = (): TextCodecHelper | undefined =>
		codec === null ? (codec = nativeCodec(scope)) : codec;

	const encode = (input: string): Uint8Array => {
		const helper = native();
		return helper && !LONE_SURROGATE.test(input)
			? new Uint8Array(helper.encode(input))
			: encodeInScript(input);
	};

	class TextEncoderFill {
		get encoding(): string {
			return "utf-8";
		}

		encode(input: string = ""): Uint8Array {
			return encode(`${input}`);
		}

		encodeInto(source: string, destination: Uint8Array): { read: number; written: number } {
			if (!(destination instanceof Uint8Array))
				throw new TypeError("TextEncoder.encodeInto writes into a Uint8Array.");
			const text = `${source}`;
			let read = 0;
			let written = 0;
			const scratch = new Uint8Array(4);
			while (read < text.length) {
				let code = text.charCodeAt(read);
				let units = 1;
				if (code >= 0xd800 && code <= 0xdfff) {
					const next = text.charCodeAt(read + 1);
					if (code <= 0xdbff && next >= 0xdc00 && next <= 0xdfff) {
						code = 0x10000 + ((code - 0xd800) << 10) + (next - 0xdc00);
						units = 2;
					} else code = 0xfffd;
				}
				const size = writeCodePoint(scratch, 0, code);
				if (written + size > destination.length) break;
				destination.set(scratch.subarray(0, size), written);
				written += size;
				read += units;
			}
			return { read, written };
		}
	}

	const decoders = new WeakMap<object, DecoderState>();

	class TextDecoderFill {
		constructor(label: string = "utf-8", options: TextDecoderOptions = {}) {
			// Encoding § 4.2: a label is trimmed of ASCII whitespace only, not of JavaScript's.
			const name = `${label}`.replace(/^[\t\n\f\r ]+|[\t\n\f\r ]+$/g, "").toLowerCase();
			if (!UTF8_LABELS.includes(name))
				throw new RangeError(
					`TextDecoder can't decode "${label}": only UTF-8 is supported on Lynx.`,
				);
			decoders.set(this, newState(Boolean(options?.fatal), Boolean(options?.ignoreBOM)));
		}

		get encoding(): string {
			return "utf-8";
		}

		get fatal(): boolean {
			return decoders.get(this)!.fatal;
		}

		get ignoreBOM(): boolean {
			return decoders.get(this)!.ignoreBOM;
		}

		decode(input?: AllowSharedBufferSource, options: TextDecodeOptions = {}): string {
			const state = decoders.get(this)!;
			const stream = Boolean(options?.stream);
			if (!state.streaming) reset(state);
			state.streaming = stream;
			const bytes = input === undefined ? new Uint8Array(0) : bytesOf(input, "TextDecoder.decode");
			const helper = state.needed === 0 ? native() : undefined;
			if (helper) {
				const whole = wellFormedLength(bytes);
				const rest = bytes.length - whole;
				if (rest === 0 || (stream && rest < 4 && wellFormedTail(bytes.subarray(whole)))) {
					const bom = (at: number): boolean =>
						bytes[at] === 0xef && bytes[at + 1] === 0xbb && bytes[at + 2] === 0xbf;
					// A native codec drops a BOM its input starts with: only the stream's first BOM is
					// dropped here, and input that starts with any other goes to the decoder in script.
					const start = !state.started && !state.ignoreBOM && bom(0) ? 3 : 0;
					if (start < whole && bom(start)) return decodeInScript(state, bytes, stream);
					const head = bytes.slice(start, whole);
					const text = head.length === 0 ? "" : helper.decode(head.buffer);
					if (whole > 0) state.started = true;
					return text + (rest === 0 ? "" : decodeInScript(state, bytes.subarray(whole), stream));
				}
			}
			return decodeInScript(state, bytes, stream);
		}
	}

	return {
		// Boundary: the Encoding Standard's classes, as TypeScript's DOM library types them.
		TextEncoder: named(TextEncoderFill, "TextEncoder") as unknown as TextEncoderClass,
		TextDecoder: named(TextDecoderFill, "TextDecoder") as unknown as TextDecoderClass,
	};
}

/** Whether `tail` is the start of a sequence that more bytes may finish. */
function wellFormedTail(tail: Uint8Array): boolean {
	const [needed, lower, upper] = leadOf(tail[0]!);
	if (needed === 0 || tail.length > needed) return false;
	if (tail.length > 1 && (tail[1]! < lower || tail[1]! > upper)) return false;
	for (let index = 2; index < tail.length; index++)
		if ((tail[index]! & 0xc0) !== 0x80) return false;
	return true;
}

/** A decoder's state between the calls of a stream (§ 9.1.1 "UTF-8 decoder"). */
interface DecoderState {
	fatal: boolean;
	ignoreBOM: boolean;
	streaming: boolean;
	/** Whether a code point has been given since the stream started: a BOM after it is text. */
	started: boolean;
	codePoint: number;
	seen: number;
	needed: number;
	lower: number;
	upper: number;
}

function newState(fatal: boolean, ignoreBOM: boolean): DecoderState {
	return {
		fatal,
		ignoreBOM,
		streaming: false,
		started: false,
		codePoint: 0,
		seen: 0,
		needed: 0,
		lower: 0x80,
		upper: 0xbf,
	};
}

function reset(state: DecoderState): void {
	Object.assign(state, newState(state.fatal, state.ignoreBOM));
}

/** UTF-8's decoder, in JavaScript, from where the state left off. */
function decodeInScript(state: DecoderState, bytes: Uint8Array, stream: boolean): string {
	const units: number[] = [];
	const emit = (code: number): void => {
		if (!state.started) {
			state.started = true;
			if (code === 0xfeff && !state.ignoreBOM) return;
		}
		if (code > 0xffff) {
			code -= 0x10000;
			units.push(0xd800 + (code >> 10), 0xdc00 + (code & 0x3ff));
		} else units.push(code);
	};
	const fail = (): void => {
		if (state.fatal) {
			reset(state);
			throw new TypeError("TextDecoder was given bytes that are not UTF-8.");
		}
		emit(0xfffd);
	};
	for (let index = 0; index < bytes.length; index++) {
		const byte = bytes[index]!;
		if (state.needed === 0) {
			if (byte < 0x80) emit(byte);
			else {
				const [needed, lower, upper] = leadOf(byte);
				if (needed === 0) fail();
				else Object.assign(state, { needed, lower, upper, codePoint: byte & (0x3f >> needed) });
			}
			continue;
		}
		if (byte < state.lower || byte > state.upper) {
			Object.assign(state, { codePoint: 0, needed: 0, seen: 0, lower: 0x80, upper: 0xbf });
			fail();
			index--;
			continue;
		}
		state.lower = 0x80;
		state.upper = 0xbf;
		state.codePoint = (state.codePoint << 6) | (byte & 0x3f);
		if (++state.seen === state.needed) {
			const code = state.codePoint;
			Object.assign(state, { codePoint: 0, needed: 0, seen: 0 });
			emit(code);
		}
	}
	if (!stream && state.needed !== 0) {
		Object.assign(state, { codePoint: 0, needed: 0, seen: 0, lower: 0x80, upper: 0xbf });
		fail();
	}
	return textOf(units);
}
