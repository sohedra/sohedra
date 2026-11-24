// A request's or a response's body: the Fetch Standard § 5.1 "Body mixin", § 2.2.8's body (a stream,
// its source), and § 5.1's "extract a body". Used by the fetch fill (fetch.ts). A body is read from
// its source as late as it can be: bytes held in memory are read without a stream, and a stream is
// made only when the app asks for `body`. A body made from a stream has that stream as its `body`.
// A body is used once its stream has been read from or cancelled, by anyone, or once a mixin
// method has read it.
//
// A promise here resolves with a record (record.ts), never a plain object, so a page's
// `Object.prototype.then` can't step into a body read. A body's stream is read whole through
// `pipeTo`, which reads without a promise per chunk.

import type { Scope } from "../globals.ts";
import { bytesOf } from "./encoding.ts";
import { decodeMultipart, encodeMultipart, multipartBoundary } from "./form-data.ts";
import { record } from "./record.ts";
import type { Loaded, Pulled } from "./record.ts";
import type {
	BlobClass,
	FormDataClass,
	ReadableStreamClass,
	TextDecoderClass,
	TextEncoderClass,
	TransformStreamClass,
	URLSearchParamsClass,
	WritableStreamClass,
} from "./standard-classes.ts";

/** Reads a body's chunks one at a time, as a stream's reader does. */
export interface Puller {
	read(): Promise<Pulled>;
	cancel(reason: unknown): unknown;
}

/** Where a body's bytes come from: in memory, loaded once, pulled chunk by chunk, or a stream. */
export type Source =
	| { bytes: Uint8Array }
	| { load: () => Promise<Loaded> }
	| { open: () => Puller }
	| { stream: ReadableStream };

/** What extracting a body gives: its source, and the `Content-Type` it implies. */
interface Extracted {
	source: Source;
	type: string | null;
}

/** `Object.prototype.toString`'s tag of a value: how a standard object is told apart in any realm. */
function tagOf(value: unknown): string {
	return Object.prototype.toString.call(value).slice(8, -1);
}

/** Whether `value` is a stream that can be read: a `ReadableStream` of any realm. */
export function isReadableStream(value: unknown): value is ReadableStream {
	return (
		typeof value === "object" &&
		value !== null &&
		typeof (value as ReadableStream).getReader === "function" &&
		typeof (value as ReadableStream).tee === "function"
	);
}

/** The thread's UTF-8 encoder, as text to bytes. */
function encodeText(scope: Scope, text: string): Uint8Array {
	// Boundary: the thread's `TextEncoder`, which this folder fills on both threads.
	return new (scope["TextEncoder"] as TextEncoderClass)().encode(text);
}

/** § 5.1 "extract a body" of `value`, which a constructor checked is not `null`. */
export function extractBody(scope: Scope, value: unknown): Extracted {
	const tag = tagOf(value);
	if (typeof value === "string")
		return { source: { bytes: encodeText(scope, value) }, type: "text/plain;charset=UTF-8" };
	if (tag === "URLSearchParams")
		return {
			source: { bytes: encodeText(scope, `${value as URLSearchParams}`) },
			type: "application/x-www-form-urlencoded;charset=UTF-8",
		};
	if (tag === "ArrayBuffer" || tag === "SharedArrayBuffer")
		return { source: { bytes: new Uint8Array(value as ArrayBuffer).slice() }, type: null };
	if (ArrayBuffer.isView(value))
		return { source: { bytes: bytesOf(value, "A body").slice() }, type: null };
	if (tag === "FormData") {
		const form = snapshot(scope, value as FormData);
		const boundary = multipartBoundary();
		return {
			source: { load: () => encodeMultipart(form, boundary) },
			type: `multipart/form-data; boundary=${boundary}`,
		};
	}
	if (tag === "Blob" || tag === "File") {
		const blob = value as Blob;
		return {
			source: { load: async () => record({ bytes: new Uint8Array(await blob.arrayBuffer()) }) },
			type: blob.type === "" ? null : blob.type,
		};
	}
	if (isReadableStream(value)) {
		if (value.locked) throw new TypeError("A body can't be a stream another reader holds.");
		if (isDisturbed(value)) throw new TypeError("A body can't be a stream someone has read.");
		return { source: { stream: value }, type: null };
	}
	return {
		source: { bytes: encodeText(scope, `${value as string}`) },
		type: "text/plain;charset=UTF-8",
	};
}

/** `form`'s entries as they are now: a body is the form as it was when the body was made. */
function snapshot(scope: Scope, form: FormData): FormData {
	// Boundary: the thread's `FormData`, this folder's or an engine's.
	const FormDataClass = scope["FormData"] as FormDataClass | undefined;
	if (typeof FormDataClass !== "function") return form;
	const copy = new FormDataClass();
	for (const [name, value] of form) copy.append(name, value);
	return copy;
}

/**
 * Whether someone has read from or cancelled `stream`: the Streams Standard's [[disturbed]], which
 * no method shows. The streams fill (web-streams-polyfill, pinned to its exact version) keeps it as
 * `_disturbed`; a stream of another implementation shows none, and counts as not disturbed.
 */
function isDisturbed(stream: ReadableStream): boolean {
	// Boundary: web-streams-polyfill's field, which tests/unit/fetch.test.ts checks.
	return (stream as { _disturbed?: unknown })._disturbed === true;
}

/** A copy of a chunk for a clone's branch: Fetch's tee clones each chunk with StructuredClone. */
function copyOf(scope: Scope, chunk: unknown): unknown {
	if (tagOf(chunk) === "ArrayBuffer") return (chunk as ArrayBuffer).slice(0);
	if (ArrayBuffer.isView(chunk)) {
		// Boundary: a view's own class, which takes a buffer, an offset and a length.
		const View = chunk.constructor as new (
			buffer: ArrayBufferLike,
			offset: number,
			length: number,
		) => ArrayBufferView;
		const length = "BYTES_PER_ELEMENT" in chunk ? (chunk as Uint8Array).length : chunk.byteLength;
		return new View(chunk.buffer.slice(0), chunk.byteOffset, length);
	}
	// Boundary: the thread's `structuredClone`, which this folder fills.
	const clone = scope["structuredClone"] as ((value: unknown) => unknown) | undefined;
	return typeof clone === "function" ? clone(chunk) : chunk;
}

/** A body: where it comes from, its stream once made, and whether it has been used. */
export class Body {
	private used = false;
	private stream: ReadableStream<Uint8Array> | undefined;
	/** Whether its stream is the byte stream this made, not one it was given. */
	private made = false;
	private readonly scope: Scope;
	private readonly source: Source;

	constructor(scope: Scope, source: Source) {
		this.scope = scope;
		this.source = source;
		if ("stream" in source) this.stream = source.stream;
	}

	/** Whether it has been read from (the standard's "disturbed"). */
	get disturbed(): boolean {
		return this.used || (this.stream !== undefined && isDisturbed(this.stream));
	}

	/** Whether it can't be read: used, or its stream held by a reader. */
	get unusable(): boolean {
		return this.disturbed || this.stream?.locked === true;
	}

	/** Its stream, made the first time it is asked for. */
	readable(): ReadableStream<Uint8Array> {
		if (this.stream) return this.stream;
		const source = this.source;
		let puller: Puller | undefined;
		const open = (): Puller => {
			if (puller) return puller;
			if ("open" in source) return (puller = source.open());
			let given = false;
			return (puller = {
				async read() {
					if (given) return record({ done: true });
					given = true;
					const value =
						"bytes" in source
							? source.bytes
							: "load" in source
								? (await source.load()).bytes
								: EMPTY;
					return value.byteLength === 0
						? record({ done: true })
						: record({ done: false, value: value.slice() });
				},
				cancel() {},
			});
		};
		// Boundary: the thread's `ReadableStream`, which this folder fills on the background.
		const Stream = this.scope["ReadableStream"] as ReadableStreamClass;
		// A byte stream, as Fetch's body is, so a BYOB reader can read it.
		this.stream = new Stream<Uint8Array>(
			{
				type: "bytes",
				pull: async (controller) => {
					this.used = true;
					const { done, value } = await open().read();
					if (done) {
						controller.close();
						// A BYOB read waiting as the stream ends is answered done (Streams § 4.10.11).
						// Boundary: a byte stream's controller, as the source asked for.
						(controller as ReadableByteStreamController).byobRequest?.respond(0);
					}
					// Boundary: a chunk over an ArrayBuffer, which is all a body's source gives.
					else controller.enqueue(value as Uint8Array<ArrayBuffer>);
				},
				cancel: (reason) => {
					this.used = true;
					return puller?.cancel(reason) as undefined;
				},
			},
			// No chunk is pulled before a read asks for one: a body is used only once read.
			{ highWaterMark: 0 },
		);
		this.made = true;
		// A body a mixin method has read whole has a stream the reader that read it holds.
		if (this.used) this.stream.getReader();
		return this.stream;
	}

	/** All its bytes: the mixin methods' "fully read". Rejects when it is unusable. */
	async bytes(): Promise<Loaded> {
		if (this.unusable) throw new TypeError("This body has already been read.");
		const source = this.source;
		if (!this.stream && ("bytes" in source || "load" in source)) {
			this.used = true;
			return record({
				bytes: ("bytes" in source ? source.bytes : (await source.load()).bytes).slice(),
			});
		}
		const stream = this.readable();
		this.used = true;
		const parts: Uint8Array[] = [];
		let size = 0;
		// Boundary: the thread's `WritableStream`, which this folder fills with the streams.
		const Writable = this.scope["WritableStream"] as WritableStreamClass;
		await stream.pipeTo(
			new Writable({
				write(chunk: unknown) {
					const part = bytesOf(chunk, "A body's stream");
					parts.push(part);
					size += part.byteLength;
				},
			}),
		);
		const whole = new Uint8Array(size);
		let at = 0;
		for (const part of parts) {
			whole.set(part, at);
			at += part.byteLength;
		}
		return record({ bytes: whole });
	}

	/**
	 * This body handed on, for another request made from this one's: the new body reads what this
	 * one would have, and this one counts as used.
	 */
	transfer(): Body {
		if (this.unusable) throw new TypeError("This body has already been read.");
		const next = new Body(this.scope, this.stream ? { stream: this.stream } : this.source);
		next.made = this.made;
		this.used = true;
		return next;
	}

	/** Two bodies that read the same bytes: the standard's "clone a body", which tees a stream. */
	clone(): [Body, Body] {
		if (this.unusable) throw new TypeError("A body that has been read can't be cloned.");
		const source = this.source;
		if (!this.stream && ("bytes" in source || "load" in source))
			return [new Body(this.scope, source), new Body(this.scope, source)];
		const stream = this.readable();
		const [first, second] = stream.tee();
		const scope = this.scope;
		// A byte stream's tee copies each chunk for its second branch already; a stream of another
		// kind's tee doesn't, and Fetch's does.
		const copied = this.made
			? second
			: second.pipeThrough(
					// Boundary: the thread's `TransformStream`, which this folder fills with the streams.
					new (scope["TransformStream"] as TransformStreamClass)({
						transform(chunk, controller) {
							controller.enqueue(copyOf(scope, chunk));
						},
					}),
				);
		const firstBody = new Body(scope, { stream: first });
		firstBody.made = this.made;
		const secondBody = new Body(scope, { stream: copied });
		secondBody.made = this.made;
		return [firstBody, secondBody];
	}
}

const EMPTY: Uint8Array = new Uint8Array(0);

/** A `Content-Type`'s essence: its type and subtype, lowercased. */
function essenceOf(type: string | null): string {
	return (type ?? "").split(";")[0]!.trim().toLowerCase();
}

/** The Body mixin's methods, for a prototype whose instances' bodies `bodyOf` gives. */
export function defineBodyMixin(
	prototype: object,
	scope: Scope,
	bodyOf: (owner: unknown) => { body: Body | null; headers: Headers },
): void {
	const read = async (owner: unknown): Promise<Loaded> => {
		const { body } = bodyOf(owner);
		return body ? body.bytes() : record({ bytes: new Uint8Array(0) });
	};
	const decode = (bytes: Uint8Array): string =>
		// Boundary: the thread's `TextDecoder`, which this folder fills on both threads.
		new (scope["TextDecoder"] as TextDecoderClass)().decode(bytes);
	const methods = {
		async arrayBuffer(this: unknown): Promise<ArrayBuffer> {
			const { bytes } = await read(this);
			return bytes.buffer.slice(
				bytes.byteOffset,
				bytes.byteOffset + bytes.byteLength,
			) as ArrayBuffer;
		},
		async bytes(this: unknown): Promise<Uint8Array> {
			return (await read(this)).bytes;
		},
		async text(this: unknown): Promise<string> {
			return decode((await read(this)).bytes);
		},
		async json(this: unknown): Promise<unknown> {
			return JSON.parse(decode((await read(this)).bytes)) as unknown;
		},
		async blob(this: unknown): Promise<Blob> {
			const type = bodyOf(this).headers.get("content-type") ?? "";
			const { bytes } = await read(this);
			// Boundary: the thread's `Blob`, which this folder fills on the background.
			return new (scope["Blob"] as BlobClass)([bytes as Uint8Array<ArrayBuffer>], { type });
		},
		async formData(this: unknown): Promise<FormData> {
			const type = bodyOf(this).headers.get("content-type");
			const essence = essenceOf(type);
			// Fully read first, as Fetch's "consume body" does: a stream's error comes before the type's.
			const { bytes } = await read(this);
			if (essence === "multipart/form-data") {
				// An empty FormData's body is empty, and reads back as an empty form; no body at all
				// is not multipart.
				if (bytes.length === 0 && bodyOf(this).body !== null)
					// Boundary: the thread's `FormData`, which this folder fills.
					return new (scope["FormData"] as FormDataClass)();
				return decodeMultipart(scope, bytes, type!);
			}
			if (essence === "application/x-www-form-urlencoded") {
				// Boundary: the thread's `URLSearchParams` and `FormData`, which this folder fills.
				// The URL-encoded parser decodes UTF-8 without taking a byte order mark away.
				const params = new (scope["URLSearchParams"] as URLSearchParamsClass)(
					new (scope["TextDecoder"] as TextDecoderClass)("utf-8", { ignoreBOM: true }).decode(
						bytes,
					),
				);
				const form = new (scope["FormData"] as FormDataClass)();
				for (const [name, value] of params) form.append(name, value);
				return form;
			}
			throw new TypeError(
				`formData reads a multipart or URL-encoded body, and this one is ${type === null ? "untyped" : `"${type}"`}.`,
			);
		},
	};
	for (const [name, method] of Object.entries(methods))
		Object.defineProperty(prototype, name, { value: method, writable: true, configurable: true });
	Object.defineProperty(prototype, "body", {
		get(this: unknown): ReadableStream<Uint8Array> | null {
			return bodyOf(this).body?.readable() ?? null;
		},
		configurable: true,
	});
	Object.defineProperty(prototype, "bodyUsed", {
		get(this: unknown): boolean {
			return bodyOf(this).body?.disturbed ?? false;
		},
		configurable: true,
	});
}
