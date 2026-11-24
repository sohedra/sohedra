// `TextEncoder` and `TextDecoder`, UTF-8 as the Encoding Standard defines it, with Node's own (which
// passes the web platform tests) as the reference: in JavaScript, and over a native codec such as
// lynx-core's `TextCodecHelper`, which the fill uses only for what is well formed.

import { TextDecoder as UtilTextDecoder, TextEncoder as UtilTextEncoder } from "node:util";

import { describe, expect, it } from "@rstest/core";
import fc from "fast-check";

import { createTextEncoding, fillTextEncoding } from "../../src/fills/web/encoding.ts";

// Node's own, not the test page's DOM's.
const NodeTextEncoder: typeof TextEncoder = UtilTextEncoder;
// Boundary: Node's types of its decoder differ from the DOM library's in name only.
const NodeTextDecoder = UtilTextDecoder as unknown as typeof TextDecoder;

/** lynx-core's codec, by Node's: right for well-formed input. */
const goodCodec = {
	encode: (text: string) => new NodeTextEncoder().encode(text).buffer,
	decode: (buffer: ArrayBuffer) => new NodeTextDecoder().decode(buffer),
};

/** A codec that gets the sample wrong: the fill must not use it. */
const badCodec = {
	encode: (text: string) => Uint8Array.from(text, (c) => c.charCodeAt(0) & 0xff).buffer,
	decode: () => "?",
};

const KINDS = {
	"in JavaScript": createTextEncoding({}),
	"over a native codec": createTextEncoding({ TextCodecHelper: goodCodec }),
	"beside a native codec that is wrong": createTextEncoding({ TextCodecHelper: badCodec }),
};

/** What `run` gives, or the name of what it throws. */
function outcome(run: () => unknown): unknown {
	try {
		return { value: run() };
	} catch (error) {
		return { error: (error as Error).name };
	}
}

/** Any bytes, biased to UTF-8's lead and continuation bytes. */
const bytes = fc
	.uint8Array({ maxLength: 24 })
	.chain((plain) =>
		fc
			.array(
				fc.oneof(
					fc.constantFrom(
						0x00,
						0x41,
						0x7f,
						0x80,
						0xbf,
						0xc0,
						0xc2,
						0xdf,
						0xe0,
						0xed,
						0xef,
						0xf0,
						0xf4,
						0xf5,
						0xff,
					),
					fc.integer({ min: 0x80, max: 0xbf }),
					fc.constantFrom(0xef, 0xbb, 0xbf),
				),
				{ maxLength: 24 },
			)
			.map((weighted) => Uint8Array.from([...plain.slice(0, 4), ...weighted])),
	);

describe.each(Object.entries(KINDS))("%s", (_kind, { TextEncoder, TextDecoder }) => {
	it("encodes every string as Node's does, a lone surrogate as U+FFFD", () => {
		fc.assert(
			fc.property(fc.string({ unit: "binary" }), (text) => {
				expect([...new TextEncoder().encode(text)]).toEqual([
					...new NodeTextEncoder().encode(text),
				]);
			}),
			{ numRuns: 500 },
		);
		expect([...new TextEncoder().encode("\uD800x")]).toEqual([0xef, 0xbf, 0xbd, 0x78]);
		expect(new TextEncoder().encode()).toEqual(new Uint8Array(0));
		expect(new TextEncoder().encoding).toBe("utf-8");
	});

	it("encodes into a view as Node's does, never splitting a character", () => {
		fc.assert(
			fc.property(fc.string({ unit: "binary" }), fc.integer({ min: 0, max: 12 }), (text, size) => {
				const ours = new Uint8Array(size);
				const theirs = new Uint8Array(size);
				expect(new TextEncoder().encodeInto(text, ours)).toEqual(
					new NodeTextEncoder().encodeInto(text, theirs),
				);
				expect(ours).toEqual(theirs);
			}),
		);
	});

	it.each([[{}], [{ fatal: true }], [{ ignoreBOM: true }], [{ fatal: true, ignoreBOM: true }]])(
		"decodes or refuses any bytes as Node's does, with %j",
		(options) => {
			fc.assert(
				fc.property(bytes, (input) => {
					expect(outcome(() => new TextDecoder("utf-8", options).decode(input))).toEqual(
						outcome(() => new NodeTextDecoder("utf-8", options).decode(input)),
					);
				}),
				{ numRuns: 1000 },
			);
		},
	);

	it("decodes as a stream, split at every point, what Node's decodes whole", () => {
		// Node's own stream drops a BOM that follows U+FFFD across a split (EF | EF BB BF): the whole
		// input is the reference, as a stream's split never changes its text.
		fc.assert(
			fc.property(bytes, fc.boolean(), (input, ignoreBOM) => {
				const whole = new NodeTextDecoder("utf-8", { ignoreBOM }).decode(input);
				for (let at = 0; at <= input.length; at++) {
					const decoder = new TextDecoder("utf-8", { ignoreBOM });
					const parts = [input.subarray(0, at), input.subarray(at)];
					const text =
						parts.map((part) => decoder.decode(part, { stream: true })).join("") + decoder.decode();
					expect(text, `split at ${at}`).toBe(whole);
				}
			}),
			{ numRuns: 300 },
		);
	});

	it("keeps a BOM that comes after the stream's first character", () => {
		const decoder = new TextDecoder();
		const text =
			decoder.decode(new Uint8Array([0xff, 0x61]), { stream: true }) +
			decoder.decode(new Uint8Array([0xef, 0xbb, 0xbf, 0x62]), { stream: true }) +
			decoder.decode();
		expect(text).toBe("\uFFFDa\uFEFFb");
		expect(new TextDecoder().decode(new Uint8Array([0xef, 0xbb, 0xbf, 0xef, 0xbb, 0xbf]))).toBe(
			"\uFEFF",
		);
	});

	it("decodes a multi-byte character fed a byte at a time", () => {
		const decoder = new TextDecoder();
		const text = [0xe2, 0x82, 0xac, 0xf0, 0x9f, 0x98, 0x80]
			.map((byte) => decoder.decode(new Uint8Array([byte]), { stream: true }))
			.join("");
		expect(text + decoder.decode()).toBe("€😀");
	});

	it("takes an ArrayBuffer, any view, and nothing; refuses anything else", () => {
		const decoder = new TextDecoder();
		const buffer = new Uint8Array([0x61, 0x62, 0x63]).buffer;
		expect(decoder.decode(buffer)).toBe("abc");
		expect(decoder.decode(new DataView(buffer, 1))).toBe("bc");
		expect(decoder.decode(new Uint16Array(buffer, 0, 1))).toBe("ab");
		expect(decoder.decode()).toBe("");
		expect(() => decoder.decode("abc" as unknown as Uint8Array)).toThrow(TypeError);
	});

	it("has its options as fields, and takes UTF-8's labels only", () => {
		const decoder = new TextDecoder(" UTF8 ", { fatal: true, ignoreBOM: true });
		expect([decoder.encoding, decoder.fatal, decoder.ignoreBOM]).toEqual(["utf-8", true, true]);
		expect(new TextDecoder().fatal).toBe(false);
		expect(() => new TextDecoder("latin1")).toThrow(RangeError);
		expect(() => new TextDecoder("utf-16le")).toThrow(RangeError);
	});

	it("starts over after a fatal error", () => {
		const decoder = new TextDecoder("utf-8", { fatal: true });
		expect(() => decoder.decode(new Uint8Array([0xe2, 0x82]))).toThrow(TypeError);
		expect(decoder.decode(new Uint8Array([0x61]))).toBe("a");
	});

	it("decodes a large input", () => {
		const text = "aé€😀".repeat(20_000);
		expect(new TextDecoder().decode(new NodeTextEncoder().encode(text))).toBe(text);
	});
});

describe("over a native codec", () => {
	it("decodes and encodes what is well formed with it, and the rest in JavaScript", () => {
		const calls: string[] = [];
		const codec = {
			encode: (text: string) => (calls.push("encode"), goodCodec.encode(text)),
			decode: (buffer: ArrayBuffer) => (calls.push("decode"), goodCodec.decode(buffer)),
		};
		const { TextEncoder, TextDecoder } = createTextEncoding({ TextCodecHelper: codec });
		new TextEncoder().encode("plain");
		new TextDecoder().decode(new Uint8Array([0x61]));
		// The check of the sample, then one call each.
		expect(calls).toEqual(["encode", "decode", "encode", "decode"]);
		calls.length = 0;
		new TextEncoder().encode("\uD800");
		new TextDecoder().decode(new Uint8Array([0xff]));
		expect(calls).toEqual([]);
	});
});

describe("the fill", () => {
	it("puts both on a thread that lacks them, made on first read", () => {
		const scope: Record<string, unknown> = {};
		fillTextEncoding(scope);
		expect(Object.getOwnPropertyDescriptor(scope, "TextEncoder")?.get).toBeTypeOf("function");
		const Encoder = scope["TextEncoder"] as typeof TextEncoder;
		expect(Encoder.name).toBe("TextEncoder");
		expect(
			new (scope["TextDecoder"] as typeof TextDecoder)().decode(new Encoder().encode("€")),
		).toBe("€");
	});

	it("leaves a thread's own that works, and replaces lynx-core-like ones that decode only valid UTF-8", () => {
		const own = { TextEncoder: NodeTextEncoder, TextDecoder: NodeTextDecoder };
		const scope: Record<string, unknown> = { ...own };
		fillTextEncoding(scope);
		expect(scope).toEqual(own);
		class Broken {
			encode() {
				return new Uint8Array(0);
			}
			decode() {
				return "";
			}
		}
		const broken: Record<string, unknown> = { TextEncoder: Broken, TextDecoder: Broken };
		fillTextEncoding(broken);
		expect(broken["TextEncoder"]).not.toBe(Broken);
		expect(broken["TextDecoder"]).not.toBe(Broken);
	});
});

describe("a TextDecoder's label", () => {
	const { TextDecoder: Decoder } = createTextEncoding({});

	it("is trimmed of ASCII whitespace only, as the Encoding Standard's labels are", () => {
		expect(new Decoder(" \tutf-8\n").encoding).toBe("utf-8");
		expect(() => new Decoder("\vutf-8")).toThrow(RangeError);
		expect(() => new Decoder("\u00A0utf-8")).toThrow(RangeError);
	});
});
