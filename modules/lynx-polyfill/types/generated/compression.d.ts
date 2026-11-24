// Generated from TypeScript 6.0's lib.webworker.d.ts by `pnpm -F @sohedra/lynx-polyfill generate`: do not edit.
// What `import "@sohedra/lynx-polyfill/compression"` installs on either thread: its globals' types.
// TypeScript's declarations are Copyright Microsoft Corporation, Apache License 2.0.

/// <reference path="./web.d.ts" />

declare global {
	var ByteLengthQueuingStrategy: {
		prototype: ByteLengthQueuingStrategy;
		new (init: QueuingStrategyInit): ByteLengthQueuingStrategy;
	};
	var CompressionStream: {
		prototype: CompressionStream;
		new (format: CompressionFormat): CompressionStream;
	};
	var CountQueuingStrategy: {
		prototype: CountQueuingStrategy;
		new (init: QueuingStrategyInit): CountQueuingStrategy;
	};
	var DOMException: {
		prototype: DOMException;
		new (message?: string, name?: string): DOMException;
		readonly INDEX_SIZE_ERR: 1;
		readonly DOMSTRING_SIZE_ERR: 2;
		readonly HIERARCHY_REQUEST_ERR: 3;
		readonly WRONG_DOCUMENT_ERR: 4;
		readonly INVALID_CHARACTER_ERR: 5;
		readonly NO_DATA_ALLOWED_ERR: 6;
		readonly NO_MODIFICATION_ALLOWED_ERR: 7;
		readonly NOT_FOUND_ERR: 8;
		readonly NOT_SUPPORTED_ERR: 9;
		readonly INUSE_ATTRIBUTE_ERR: 10;
		readonly INVALID_STATE_ERR: 11;
		readonly SYNTAX_ERR: 12;
		readonly INVALID_MODIFICATION_ERR: 13;
		readonly NAMESPACE_ERR: 14;
		readonly INVALID_ACCESS_ERR: 15;
		readonly VALIDATION_ERR: 16;
		readonly TYPE_MISMATCH_ERR: 17;
		readonly SECURITY_ERR: 18;
		readonly NETWORK_ERR: 19;
		readonly ABORT_ERR: 20;
		readonly URL_MISMATCH_ERR: 21;
		readonly QUOTA_EXCEEDED_ERR: 22;
		readonly TIMEOUT_ERR: 23;
		readonly INVALID_NODE_TYPE_ERR: 24;
		readonly DATA_CLONE_ERR: 25;
	};
	var DecompressionStream: {
		prototype: DecompressionStream;
		new (format: CompressionFormat): DecompressionStream;
	};
	var ReadableByteStreamController: {
		prototype: ReadableByteStreamController;
		new (): ReadableByteStreamController;
	};
	var ReadableStream: {
		prototype: ReadableStream;
		new (
			underlyingSource: UnderlyingByteSource,
			strategy?: {
				highWaterMark?: number;
			},
		): ReadableStream<Uint8Array<ArrayBuffer>>;
		new <R = any>(
			underlyingSource: UnderlyingDefaultSource<R>,
			strategy?: QueuingStrategy<R>,
		): ReadableStream<R>;
		new <R = any>(
			underlyingSource?: UnderlyingSource<R>,
			strategy?: QueuingStrategy<R>,
		): ReadableStream<R>;
	};
	var ReadableStreamBYOBReader: {
		prototype: ReadableStreamBYOBReader;
		new (stream: ReadableStream<Uint8Array<ArrayBuffer>>): ReadableStreamBYOBReader;
	};
	var ReadableStreamBYOBRequest: {
		prototype: ReadableStreamBYOBRequest;
		new (): ReadableStreamBYOBRequest;
	};
	var ReadableStreamDefaultController: {
		prototype: ReadableStreamDefaultController;
		new (): ReadableStreamDefaultController;
	};
	var ReadableStreamDefaultReader: {
		prototype: ReadableStreamDefaultReader;
		new <R = any>(stream: ReadableStream<R>): ReadableStreamDefaultReader<R>;
	};
	var TransformStream: {
		prototype: TransformStream;
		new <I = any, O = any>(
			transformer?: Transformer<I, O>,
			writableStrategy?: QueuingStrategy<I>,
			readableStrategy?: QueuingStrategy<O>,
		): TransformStream<I, O>;
	};
	var TransformStreamDefaultController: {
		prototype: TransformStreamDefaultController;
		new (): TransformStreamDefaultController;
	};
	var WritableStream: {
		prototype: WritableStream;
		new <W = any>(
			underlyingSink?: UnderlyingSink<W>,
			strategy?: QueuingStrategy<W>,
		): WritableStream<W>;
	};
	var WritableStreamDefaultController: {
		prototype: WritableStreamDefaultController;
		new (): WritableStreamDefaultController;
	};
	var WritableStreamDefaultWriter: {
		prototype: WritableStreamDefaultWriter;
		new <W = any>(stream: WritableStream<W>): WritableStreamDefaultWriter<W>;
	};
}

export {};
