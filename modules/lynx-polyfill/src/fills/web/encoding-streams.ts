// `TextEncoderStream` and `TextDecoderStream`: the Encoding Standard § 8.3 and § 8.4, after Expo's
// (src/winter/TextDecoderStream.ts), over the thread's `TransformStream`, `TextEncoder` and
// `TextDecoder`. Background only, with the streams. UTF-8 only, as `TextDecoder`. Leaves out
// nothing.

import type { Scope } from "../globals.ts";
import { installLazy, named } from "../install.ts";
import type {
	TextDecoderClass,
	TextDecoderStreamClass,
	TextEncoderClass,
	TextEncoderStreamClass,
	TransformStreamClass,
} from "./standard-classes.ts";

/** @workaround web-text-encoding-streams kind=lynx-gap delete-when="Lynx's background thread has TextEncoderStream and TextDecoderStream" */
export function fillEncodingStreams(scope: Scope): void {
	installLazy(scope, "TextEncoderStream", () => createTextEncoderStream(scope), isFunction);
	installLazy(scope, "TextDecoderStream", () => createTextDecoderStream(scope), isFunction);
}

const isFunction = (existing: unknown): boolean => typeof existing === "function";

/** The stream each of these streams' `readable` and `writable` are. */
const transforms = new WeakMap<object, TransformStream>();

/** A `TransformStream` of the thread's, running `transformer`. */
function transformOf(scope: Scope, transformer: Transformer): TransformStream {
	// Boundary: the thread's `TransformStream`, this folder's or an engine's.
	return new (scope["TransformStream"] as TransformStreamClass)(transformer);
}

/** The streams' `readable` and `writable`: the Encoding Standard's `GenericTransformStream`. */
class GenericTransformStream {
	get readable(): ReadableStream {
		return own(this).readable;
	}

	get writable(): WritableStream {
		return own(this).writable;
	}
}

function own(stream: object): TransformStream {
	const found = transforms.get(stream);
	if (!found) throw new TypeError("Illegal invocation: not a text stream.");
	return found;
}

/** `TextEncoderStream`: text in, UTF-8 bytes out; a surrogate split over two chunks is kept whole. */
export function createTextEncoderStream(scope: Scope): TextEncoderStreamClass {
	class TextEncoderStreamFill extends GenericTransformStream {
		constructor() {
			super();
			// Boundary: the thread's `TextEncoder`, this folder's or an engine's.
			const encoder = new (scope["TextEncoder"] as TextEncoderClass)();
			let pending = "";
			transforms.set(
				this,
				transformOf(scope, {
					transform(chunk: unknown, controller) {
						let text = pending + `${chunk as string}`;
						pending = "";
						const last = text.charCodeAt(text.length - 1);
						if (last >= 0xd800 && last <= 0xdbff) {
							pending = text.slice(-1);
							text = text.slice(0, -1);
						}
						if (text) controller.enqueue(encoder.encode(text));
					},
					flush(controller) {
						if (pending) controller.enqueue(encoder.encode(pending));
					},
				}),
			);
		}

		get encoding(): string {
			return "utf-8";
		}
	}
	// Boundary: the class above, as TypeScript's DOM library types it.
	return named(TextEncoderStreamFill, "TextEncoderStream") as unknown as TextEncoderStreamClass;
}

/** `TextDecoderStream`: bytes in, text out, decoded as a stream. */
export function createTextDecoderStream(scope: Scope): TextDecoderStreamClass {
	const decoders = new WeakMap<object, TextDecoder>();
	class TextDecoderStreamFill extends GenericTransformStream {
		constructor(label?: string, options?: TextDecoderOptions) {
			super();
			// Boundary: the thread's `TextDecoder`, this folder's or an engine's.
			const decoder = new (scope["TextDecoder"] as TextDecoderClass)(label, options);
			decoders.set(this, decoder);
			transforms.set(
				this,
				transformOf(scope, {
					transform(chunk: AllowSharedBufferSource, controller) {
						// Web IDL's `BufferSource`: unlike `decode()`'s optional input, a chunk must be one.
						if (!ArrayBuffer.isView(chunk) && !(chunk instanceof ArrayBuffer))
							throw new TypeError(
								"TextDecoderStream takes chunks of bytes, and was given something else.",
							);
						const text = decoder.decode(chunk, { stream: true });
						if (text) controller.enqueue(text);
					},
					flush(controller) {
						const text = decoder.decode();
						if (text) controller.enqueue(text);
					},
				}),
			);
		}

		get encoding(): string {
			return decoders.get(this)!.encoding;
		}

		get fatal(): boolean {
			return decoders.get(this)!.fatal;
		}

		get ignoreBOM(): boolean {
			return decoders.get(this)!.ignoreBOM;
		}
	}
	// Boundary: the class above, as TypeScript's DOM library types it.
	return named(TextDecoderStreamFill, "TextDecoderStream") as unknown as TextDecoderStreamClass;
}
