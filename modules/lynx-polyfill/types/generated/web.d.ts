// Generated from TypeScript 6.0's lib.webworker.d.ts by `pnpm -F @sohedra/lynx-polyfill generate`: do not edit.
// The interfaces and types the package's globals name, for every import's types: none of them is a value.
// TypeScript's declarations are Copyright Microsoft Corporation, Apache License 2.0.

interface AbortController {
	readonly signal: AbortSignal;
	abort(reason?: any): void;
}

interface AbortSignal extends EventTarget {
	readonly aborted: boolean;
	onabort: ((this: AbortSignal, ev: Event) => any) | null;
	readonly reason: any;
	throwIfAborted(): void;
	addEventListener<K extends keyof AbortSignalEventMap>(
		type: K,
		listener: (this: AbortSignal, ev: AbortSignalEventMap[K]) => any,
		options?: boolean | AddEventListenerOptions,
	): void;
	addEventListener(
		type: string,
		listener: EventListenerOrEventListenerObject,
		options?: boolean | AddEventListenerOptions,
	): void;
	removeEventListener<K extends keyof AbortSignalEventMap>(
		type: K,
		listener: (this: AbortSignal, ev: AbortSignalEventMap[K]) => any,
		options?: boolean | EventListenerOptions,
	): void;
	removeEventListener(
		type: string,
		listener: EventListenerOrEventListenerObject,
		options?: boolean | EventListenerOptions,
	): void;
}

interface AbortSignalEventMap {
	abort: Event;
}

interface AddEventListenerOptions extends EventListenerOptions {
	once?: boolean;
	passive?: boolean;
	signal?: AbortSignal;
}

type AllowSharedBufferSource = ArrayBufferLike | ArrayBufferView<ArrayBufferLike>;

interface Blob {
	readonly size: number;
	readonly type: string;
	arrayBuffer(): Promise<ArrayBuffer>;
	bytes(): Promise<Uint8Array<ArrayBuffer>>;
	slice(start?: number, end?: number, contentType?: string): Blob;
	stream(): ReadableStream<Uint8Array<ArrayBuffer>>;
	text(): Promise<string>;
}

type BlobPart = BufferSource | Blob | string;

interface BlobPropertyBag {
	endings?: EndingType;
	type?: string;
}

interface Body {
	readonly body: ReadableStream<Uint8Array<ArrayBuffer>> | null;
	readonly bodyUsed: boolean;
	arrayBuffer(): Promise<ArrayBuffer>;
	blob(): Promise<Blob>;
	bytes(): Promise<Uint8Array<ArrayBuffer>>;
	formData(): Promise<FormData>;
	json(): Promise<any>;
	text(): Promise<string>;
}

type BodyInit = ReadableStream | XMLHttpRequestBodyInit;

type BufferSource = ArrayBufferView<ArrayBuffer> | ArrayBuffer;

interface ByteLengthQueuingStrategy extends QueuingStrategy<ArrayBufferView> {
	readonly highWaterMark: number;
	readonly size: QueuingStrategySize<ArrayBufferView>;
}

type CompressionFormat = "deflate" | "deflate-raw" | "gzip";

interface CompressionStream extends GenericTransformStream {
	readonly readable: ReadableStream<Uint8Array<ArrayBuffer>>;
	readonly writable: WritableStream<BufferSource>;
}

interface CountQueuingStrategy extends QueuingStrategy {
	readonly highWaterMark: number;
	readonly size: QueuingStrategySize;
}

interface CustomEvent<T = any> extends Event {
	readonly detail: T;
	initCustomEvent(type: string, bubbles?: boolean, cancelable?: boolean, detail?: T): void;
}

interface CustomEventInit<T = any> extends EventInit {
	detail?: T;
}

interface DOMException extends Error {
	readonly code: number;
	readonly message: string;
	readonly name: string;
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
}

type DOMHighResTimeStamp = number;

interface DecompressionStream extends GenericTransformStream {
	readonly readable: ReadableStream<Uint8Array<ArrayBuffer>>;
	readonly writable: WritableStream<BufferSource>;
}

type EndingType = "native" | "transparent";

interface ErrorEvent extends Event {
	readonly colno: number;
	readonly error: any;
	readonly filename: string;
	readonly lineno: number;
	readonly message: string;
}

interface ErrorEventInit extends EventInit {
	colno?: number;
	error?: any;
	filename?: string;
	lineno?: number;
	message?: string;
}

interface Event {
	readonly bubbles: boolean;
	cancelBubble: boolean;
	readonly cancelable: boolean;
	readonly composed: boolean;
	readonly currentTarget: EventTarget | null;
	readonly defaultPrevented: boolean;
	readonly eventPhase: number;
	readonly isTrusted: boolean;
	returnValue: boolean;
	readonly srcElement: EventTarget | null;
	readonly target: EventTarget | null;
	readonly timeStamp: DOMHighResTimeStamp;
	readonly type: string;
	composedPath(): EventTarget[];
	initEvent(type: string, bubbles?: boolean, cancelable?: boolean): void;
	preventDefault(): void;
	stopImmediatePropagation(): void;
	stopPropagation(): void;
	readonly NONE: 0;
	readonly CAPTURING_PHASE: 1;
	readonly AT_TARGET: 2;
	readonly BUBBLING_PHASE: 3;
}

interface EventInit {
	bubbles?: boolean;
	cancelable?: boolean;
	composed?: boolean;
}

interface EventListener {
	(evt: Event): void;
}

interface EventListenerObject {
	handleEvent(object: Event): void;
}

interface EventListenerOptions {
	capture?: boolean;
}

type EventListenerOrEventListenerObject = EventListener | EventListenerObject;

interface EventSource extends EventTarget {
	onerror: ((this: EventSource, ev: Event) => any) | null;
	onmessage: ((this: EventSource, ev: MessageEvent) => any) | null;
	onopen: ((this: EventSource, ev: Event) => any) | null;
	readonly readyState: number;
	readonly url: string;
	readonly withCredentials: boolean;
	close(): void;
	readonly CONNECTING: 0;
	readonly OPEN: 1;
	readonly CLOSED: 2;
	addEventListener<K extends keyof EventSourceEventMap>(
		type: K,
		listener: (this: EventSource, ev: EventSourceEventMap[K]) => any,
		options?: boolean | AddEventListenerOptions,
	): void;
	addEventListener(
		type: string,
		listener: (this: EventSource, event: MessageEvent) => any,
		options?: boolean | AddEventListenerOptions,
	): void;
	addEventListener(
		type: string,
		listener: EventListenerOrEventListenerObject,
		options?: boolean | AddEventListenerOptions,
	): void;
	removeEventListener<K extends keyof EventSourceEventMap>(
		type: K,
		listener: (this: EventSource, ev: EventSourceEventMap[K]) => any,
		options?: boolean | EventListenerOptions,
	): void;
	removeEventListener(
		type: string,
		listener: (this: EventSource, event: MessageEvent) => any,
		options?: boolean | EventListenerOptions,
	): void;
	removeEventListener(
		type: string,
		listener: EventListenerOrEventListenerObject,
		options?: boolean | EventListenerOptions,
	): void;
}

interface EventSourceEventMap {
	error: Event;
	message: MessageEvent;
	open: Event;
}

interface EventSourceInit {
	withCredentials?: boolean;
}

interface EventTarget {
	addEventListener(
		type: string,
		callback: EventListenerOrEventListenerObject | null,
		options?: AddEventListenerOptions | boolean,
	): void;
	dispatchEvent(event: Event): boolean;
	removeEventListener(
		type: string,
		callback: EventListenerOrEventListenerObject | null,
		options?: EventListenerOptions | boolean,
	): void;
}

interface File extends Blob {
	readonly lastModified: number;
	readonly name: string;
	readonly webkitRelativePath: string;
}

interface FilePropertyBag extends BlobPropertyBag {
	lastModified?: number;
}

interface FormData {
	append(name: string, value: string | Blob): void;
	append(name: string, value: string): void;
	append(name: string, blobValue: Blob, filename?: string): void;
	delete(name: string): void;
	get(name: string): FormDataEntryValue | null;
	getAll(name: string): FormDataEntryValue[];
	has(name: string): boolean;
	set(name: string, value: string | Blob): void;
	set(name: string, value: string): void;
	set(name: string, blobValue: Blob, filename?: string): void;
	forEach(
		callbackfn: (value: FormDataEntryValue, key: string, parent: FormData) => void,
		thisArg?: any,
	): void;
}

interface FormData {
	[Symbol.iterator](): FormDataIterator<[string, FormDataEntryValue]>;
	entries(): FormDataIterator<[string, FormDataEntryValue]>;
	keys(): FormDataIterator<string>;
	values(): FormDataIterator<FormDataEntryValue>;
}

type FormDataEntryValue = File | string;

interface FormDataIterator<T> extends IteratorObject<T, BuiltinIteratorReturn, unknown> {
	[Symbol.iterator](): FormDataIterator<T>;
}

interface GenericTransformStream {
	readonly readable: ReadableStream;
	readonly writable: WritableStream;
}

interface Headers {
	append(name: string, value: string): void;
	delete(name: string): void;
	get(name: string): string | null;
	getSetCookie(): string[];
	has(name: string): boolean;
	set(name: string, value: string): void;
	forEach(callbackfn: (value: string, key: string, parent: Headers) => void, thisArg?: any): void;
}

interface Headers {
	[Symbol.iterator](): HeadersIterator<[string, string]>;
	entries(): HeadersIterator<[string, string]>;
	keys(): HeadersIterator<string>;
	values(): HeadersIterator<string>;
}

type HeadersInit = [string, string][] | Record<string, string> | Headers;

interface HeadersIterator<T> extends IteratorObject<T, BuiltinIteratorReturn, unknown> {
	[Symbol.iterator](): HeadersIterator<T>;
}

interface MessageChannel {
	readonly port1: MessagePort;
	readonly port2: MessagePort;
}

interface MessageEvent<T = any> extends Event {
	readonly data: T;
	readonly lastEventId: string;
	readonly origin: string;
	readonly ports: ReadonlyArray<MessagePort>;
	readonly source: MessageEventSource | null;
	initMessageEvent(
		type: string,
		bubbles?: boolean,
		cancelable?: boolean,
		data?: any,
		origin?: string,
		lastEventId?: string,
		source?: MessageEventSource | null,
		ports?: MessagePort[],
	): void;
}

interface MessageEvent<T = any> {
	initMessageEvent(
		type: string,
		bubbles?: boolean,
		cancelable?: boolean,
		data?: any,
		origin?: string,
		lastEventId?: string,
		source?: MessageEventSource | null,
		ports?: Iterable<MessagePort>,
	): void;
}

interface MessageEventInit<T = any> extends EventInit {
	data?: T;
	lastEventId?: string;
	origin?: string;
	ports?: MessagePort[];
	source?: MessageEventSource | null;
}

type MessageEventSource = MessagePort;

interface MessageEventTarget<T> {
	onmessage: ((this: T, ev: MessageEvent) => any) | null;
	onmessageerror: ((this: T, ev: MessageEvent) => any) | null;
	addEventListener<K extends keyof MessageEventTargetEventMap>(
		type: K,
		listener: (this: T, ev: MessageEventTargetEventMap[K]) => any,
		options?: boolean | AddEventListenerOptions,
	): void;
	addEventListener(
		type: string,
		listener: EventListenerOrEventListenerObject,
		options?: boolean | AddEventListenerOptions,
	): void;
	removeEventListener<K extends keyof MessageEventTargetEventMap>(
		type: K,
		listener: (this: T, ev: MessageEventTargetEventMap[K]) => any,
		options?: boolean | EventListenerOptions,
	): void;
	removeEventListener(
		type: string,
		listener: EventListenerOrEventListenerObject,
		options?: boolean | EventListenerOptions,
	): void;
}

interface MessageEventTargetEventMap {
	message: MessageEvent;
	messageerror: MessageEvent;
}

interface MessagePort extends EventTarget, MessageEventTarget<MessagePort> {
	close(): void;
	postMessage(message: any, transfer: Transferable[]): void;
	postMessage(message: any, options?: StructuredSerializeOptions): void;
	start(): void;
	addEventListener<K extends keyof MessagePortEventMap>(
		type: K,
		listener: (this: MessagePort, ev: MessagePortEventMap[K]) => any,
		options?: boolean | AddEventListenerOptions,
	): void;
	addEventListener(
		type: string,
		listener: EventListenerOrEventListenerObject,
		options?: boolean | AddEventListenerOptions,
	): void;
	removeEventListener<K extends keyof MessagePortEventMap>(
		type: K,
		listener: (this: MessagePort, ev: MessagePortEventMap[K]) => any,
		options?: boolean | EventListenerOptions,
	): void;
	removeEventListener(
		type: string,
		listener: EventListenerOrEventListenerObject,
		options?: boolean | EventListenerOptions,
	): void;
}

interface MessagePortEventMap extends MessageEventTargetEventMap {
	message: MessageEvent;
	messageerror: MessageEvent;
}

interface Navigator {
	readonly product: string;
	readonly userAgent: string;
}

interface Performance extends EventTarget {
	onresourcetimingbufferfull: ((this: Performance, ev: Event) => any) | null;
	readonly timeOrigin: DOMHighResTimeStamp;
	clearMarks(markName?: string): void;
	clearMeasures(measureName?: string): void;
	clearResourceTimings(): void;
	getEntries(): PerformanceEntryList;
	getEntriesByName(name: string, type?: string): PerformanceEntryList;
	getEntriesByType(type: string): PerformanceEntryList;
	mark(markName: string, markOptions?: PerformanceMarkOptions): PerformanceMark;
	measure(
		measureName: string,
		startOrMeasureOptions?: string | PerformanceMeasureOptions,
		endMark?: string,
	): PerformanceMeasure;
	now(): DOMHighResTimeStamp;
	setResourceTimingBufferSize(maxSize: number): void;
	toJSON(): any;
	addEventListener<K extends keyof PerformanceEventMap>(
		type: K,
		listener: (this: Performance, ev: PerformanceEventMap[K]) => any,
		options?: boolean | AddEventListenerOptions,
	): void;
	addEventListener(
		type: string,
		listener: EventListenerOrEventListenerObject,
		options?: boolean | AddEventListenerOptions,
	): void;
	removeEventListener<K extends keyof PerformanceEventMap>(
		type: K,
		listener: (this: Performance, ev: PerformanceEventMap[K]) => any,
		options?: boolean | EventListenerOptions,
	): void;
	removeEventListener(
		type: string,
		listener: EventListenerOrEventListenerObject,
		options?: boolean | EventListenerOptions,
	): void;
}

interface PerformanceEntry {
	readonly duration: DOMHighResTimeStamp;
	readonly entryType: string;
	readonly name: string;
	readonly startTime: DOMHighResTimeStamp;
	toJSON(): any;
}

type PerformanceEntryList = PerformanceEntry[];

interface PerformanceEventMap {
	resourcetimingbufferfull: Event;
}

interface PerformanceMark extends PerformanceEntry {
	readonly detail: any;
}

interface PerformanceMarkOptions {
	detail?: any;
	startTime?: DOMHighResTimeStamp;
}

interface PerformanceMeasure extends PerformanceEntry {
	readonly detail: any;
}

interface PerformanceMeasureOptions {
	detail?: any;
	duration?: DOMHighResTimeStamp;
	end?: string | DOMHighResTimeStamp;
	start?: string | DOMHighResTimeStamp;
}

interface PromiseRejectionEvent extends Event {
	readonly promise: Promise<any>;
	readonly reason: any;
}

interface PromiseRejectionEventInit extends EventInit {
	promise: Promise<any>;
	reason?: any;
}

interface QueuingStrategy<T = any> {
	highWaterMark?: number;
	size?: QueuingStrategySize<T>;
}

interface QueuingStrategyInit {
	highWaterMark: number;
}

interface QueuingStrategySize<T = any> {
	(chunk: T): number;
}

interface ReadableByteStreamController {
	readonly byobRequest: ReadableStreamBYOBRequest | null;
	readonly desiredSize: number | null;
	close(): void;
	enqueue(chunk: ArrayBufferView<ArrayBuffer>): void;
	error(e?: any): void;
}

interface ReadableStream<R = any> {
	readonly locked: boolean;
	cancel(reason?: any): Promise<void>;
	getReader(options: { mode: "byob" }): ReadableStreamBYOBReader;
	getReader(): ReadableStreamDefaultReader<R>;
	getReader(options?: ReadableStreamGetReaderOptions): ReadableStreamReader<R>;
	pipeThrough<T>(
		transform: ReadableWritablePair<T, R>,
		options?: StreamPipeOptions,
	): ReadableStream<T>;
	pipeTo(destination: WritableStream<R>, options?: StreamPipeOptions): Promise<void>;
	tee(): [ReadableStream<R>, ReadableStream<R>];
}

interface ReadableStream<R = any> {
	[Symbol.asyncIterator](options?: ReadableStreamIteratorOptions): ReadableStreamAsyncIterator<R>;
	values(options?: ReadableStreamIteratorOptions): ReadableStreamAsyncIterator<R>;
}

interface ReadableStreamAsyncIterator<T> extends AsyncIteratorObject<
	T,
	BuiltinIteratorReturn,
	unknown
> {
	[Symbol.asyncIterator](): ReadableStreamAsyncIterator<T>;
}

interface ReadableStreamBYOBReader extends ReadableStreamGenericReader {
	read<T extends Exclude<BufferSource, ArrayBuffer>>(
		view: T,
		options?: ReadableStreamBYOBReaderReadOptions,
	): Promise<ReadableStreamReadResult<T>>;
	releaseLock(): void;
}

interface ReadableStreamBYOBReaderReadOptions {
	min?: number;
}

interface ReadableStreamBYOBRequest {
	readonly view: ArrayBufferView<ArrayBuffer> | null;
	respond(bytesWritten: number): void;
	respondWithNewView(view: ArrayBufferView<ArrayBuffer>): void;
}

type ReadableStreamController<T> =
	| ReadableStreamDefaultController<T>
	| ReadableByteStreamController;

interface ReadableStreamDefaultController<R = any> {
	readonly desiredSize: number | null;
	close(): void;
	enqueue(chunk: R): void;
	error(e?: any): void;
}

interface ReadableStreamDefaultReader<R = any> extends ReadableStreamGenericReader {
	read(): Promise<ReadableStreamReadResult<R>>;
	releaseLock(): void;
}

interface ReadableStreamGenericReader {
	readonly closed: Promise<void>;
	cancel(reason?: any): Promise<void>;
}

interface ReadableStreamGetReaderOptions {
	mode?: ReadableStreamReaderMode;
}

interface ReadableStreamIteratorOptions {
	preventCancel?: boolean;
}

interface ReadableStreamReadDoneResult<T> {
	done: true;
	value: T | undefined;
}

type ReadableStreamReadResult<T> =
	| ReadableStreamReadValueResult<T>
	| ReadableStreamReadDoneResult<T>;

interface ReadableStreamReadValueResult<T> {
	done: false;
	value: T;
}

type ReadableStreamReader<T> = ReadableStreamDefaultReader<T> | ReadableStreamBYOBReader;

type ReadableStreamReaderMode = "byob";

type ReadableStreamType = "bytes";

interface ReadableWritablePair<R = any, W = any> {
	readable: ReadableStream<R>;
	writable: WritableStream<W>;
}

type ReferrerPolicy =
	| ""
	| "no-referrer"
	| "no-referrer-when-downgrade"
	| "origin"
	| "origin-when-cross-origin"
	| "same-origin"
	| "strict-origin"
	| "strict-origin-when-cross-origin"
	| "unsafe-url";

interface Request extends Body {
	readonly cache: RequestCache;
	readonly credentials: RequestCredentials;
	readonly destination: RequestDestination;
	readonly headers: Headers;
	readonly integrity: string;
	readonly keepalive: boolean;
	readonly method: string;
	readonly mode: RequestMode;
	readonly redirect: RequestRedirect;
	readonly referrer: string;
	readonly referrerPolicy: ReferrerPolicy;
	readonly signal: AbortSignal;
	readonly url: string;
	clone(): Request;
}

type RequestCache =
	| "default"
	| "force-cache"
	| "no-cache"
	| "no-store"
	| "only-if-cached"
	| "reload";

type RequestCredentials = "include" | "omit" | "same-origin";

type RequestDestination =
	| ""
	| "audio"
	| "audioworklet"
	| "document"
	| "embed"
	| "font"
	| "frame"
	| "iframe"
	| "image"
	| "manifest"
	| "object"
	| "paintworklet"
	| "report"
	| "script"
	| "sharedworker"
	| "style"
	| "track"
	| "video"
	| "worker"
	| "xslt";

type RequestInfo = Request | string;

interface RequestInit {
	body?: BodyInit | null;
	cache?: RequestCache;
	credentials?: RequestCredentials;
	headers?: HeadersInit;
	integrity?: string;
	keepalive?: boolean;
	method?: string;
	mode?: RequestMode;
	priority?: RequestPriority;
	redirect?: RequestRedirect;
	referrer?: string;
	referrerPolicy?: ReferrerPolicy;
	signal?: AbortSignal | null;
	window?: null;
}

type RequestMode = "cors" | "navigate" | "no-cors" | "same-origin";

type RequestPriority = "auto" | "high" | "low";

type RequestRedirect = "error" | "follow" | "manual";

interface Response extends Body {
	readonly headers: Headers;
	readonly ok: boolean;
	readonly redirected: boolean;
	readonly status: number;
	readonly statusText: string;
	readonly type: ResponseType;
	readonly url: string;
	clone(): Response;
}

interface ResponseInit {
	headers?: HeadersInit;
	status?: number;
	statusText?: string;
}

type ResponseType = "basic" | "cors" | "default" | "error" | "opaque" | "opaqueredirect";

interface StreamPipeOptions {
	preventAbort?: boolean;
	preventCancel?: boolean;
	preventClose?: boolean;
	signal?: AbortSignal;
}

interface StructuredSerializeOptions {
	transfer?: Transferable[];
}

interface TextDecodeOptions {
	stream?: boolean;
}

interface TextDecoder extends TextDecoderCommon {
	decode(input?: AllowSharedBufferSource, options?: TextDecodeOptions): string;
}

interface TextDecoderCommon {
	readonly encoding: string;
	readonly fatal: boolean;
	readonly ignoreBOM: boolean;
}

interface TextDecoderOptions {
	fatal?: boolean;
	ignoreBOM?: boolean;
}

interface TextDecoderStream extends GenericTransformStream, TextDecoderCommon {
	readonly readable: ReadableStream<string>;
	readonly writable: WritableStream<BufferSource>;
}

interface TextEncoder extends TextEncoderCommon {
	encode(input?: string): Uint8Array<ArrayBuffer>;
	encodeInto(source: string, destination: Uint8Array<ArrayBufferLike>): TextEncoderEncodeIntoResult;
}

interface TextEncoderCommon {
	readonly encoding: string;
}

interface TextEncoderEncodeIntoResult {
	read: number;
	written: number;
}

interface TextEncoderStream extends GenericTransformStream, TextEncoderCommon {
	readonly readable: ReadableStream<Uint8Array<ArrayBuffer>>;
	readonly writable: WritableStream<string>;
}

type Transferable = MessagePort | ReadableStream | WritableStream | TransformStream | ArrayBuffer;

interface TransformStream<I = any, O = any> {
	readonly readable: ReadableStream<O>;
	readonly writable: WritableStream<I>;
}

interface TransformStreamDefaultController<O = any> {
	readonly desiredSize: number | null;
	enqueue(chunk?: O): void;
	error(reason?: any): void;
	terminate(): void;
}

interface Transformer<I = any, O = any> {
	flush?: TransformerFlushCallback<O>;
	readableType?: undefined;
	start?: TransformerStartCallback<O>;
	transform?: TransformerTransformCallback<I, O>;
	writableType?: undefined;
}

interface TransformerFlushCallback<O> {
	(controller: TransformStreamDefaultController<O>): void | PromiseLike<void>;
}

interface TransformerStartCallback<O> {
	(controller: TransformStreamDefaultController<O>): any;
}

interface TransformerTransformCallback<I, O> {
	(chunk: I, controller: TransformStreamDefaultController<O>): void | PromiseLike<void>;
}

interface URL {
	hash: string;
	host: string;
	hostname: string;
	href: string;
	toString(): string;
	readonly origin: string;
	password: string;
	pathname: string;
	port: string;
	protocol: string;
	search: string;
	readonly searchParams: URLSearchParams;
	username: string;
	toJSON(): string;
}

interface URLPattern {
	readonly hasRegExpGroups: boolean;
	readonly hash: string;
	readonly hostname: string;
	readonly password: string;
	readonly pathname: string;
	readonly port: string;
	readonly protocol: string;
	readonly search: string;
	readonly username: string;
	exec(input?: URLPatternInput, baseURL?: string | URL): URLPatternResult | null;
	test(input?: URLPatternInput, baseURL?: string | URL): boolean;
}

interface URLPatternComponentResult {
	groups: Record<string, string | undefined>;
	input: string;
}

interface URLPatternInit {
	baseURL?: string;
	hash?: string;
	hostname?: string;
	password?: string;
	pathname?: string;
	port?: string;
	protocol?: string;
	search?: string;
	username?: string;
}

type URLPatternInput = string | URLPatternInit;

interface URLPatternOptions {
	ignoreCase?: boolean;
}

interface URLPatternResult {
	hash: URLPatternComponentResult;
	hostname: URLPatternComponentResult;
	inputs: URLPatternInput[];
	password: URLPatternComponentResult;
	pathname: URLPatternComponentResult;
	port: URLPatternComponentResult;
	protocol: URLPatternComponentResult;
	search: URLPatternComponentResult;
	username: URLPatternComponentResult;
}

interface URLSearchParams {
	readonly size: number;
	append(name: string, value: string): void;
	delete(name: string, value?: string): void;
	get(name: string): string | null;
	getAll(name: string): string[];
	has(name: string, value?: string): boolean;
	set(name: string, value: string): void;
	sort(): void;
	toString(): string;
	forEach(
		callbackfn: (value: string, key: string, parent: URLSearchParams) => void,
		thisArg?: any,
	): void;
}

interface URLSearchParams {
	[Symbol.iterator](): URLSearchParamsIterator<[string, string]>;
	entries(): URLSearchParamsIterator<[string, string]>;
	keys(): URLSearchParamsIterator<string>;
	values(): URLSearchParamsIterator<string>;
}

interface URLSearchParamsIterator<T> extends IteratorObject<T, BuiltinIteratorReturn, unknown> {
	[Symbol.iterator](): URLSearchParamsIterator<T>;
}

interface UnderlyingByteSource {
	autoAllocateChunkSize?: number;
	cancel?: UnderlyingSourceCancelCallback;
	pull?: (controller: ReadableByteStreamController) => void | PromiseLike<void>;
	start?: (controller: ReadableByteStreamController) => any;
	type: "bytes";
}

interface UnderlyingDefaultSource<R = any> {
	cancel?: UnderlyingSourceCancelCallback;
	pull?: (controller: ReadableStreamDefaultController<R>) => void | PromiseLike<void>;
	start?: (controller: ReadableStreamDefaultController<R>) => any;
	type?: undefined;
}

interface UnderlyingSink<W = any> {
	abort?: UnderlyingSinkAbortCallback;
	close?: UnderlyingSinkCloseCallback;
	start?: UnderlyingSinkStartCallback;
	type?: undefined;
	write?: UnderlyingSinkWriteCallback<W>;
}

interface UnderlyingSinkAbortCallback {
	(reason?: any): void | PromiseLike<void>;
}

interface UnderlyingSinkCloseCallback {
	(): void | PromiseLike<void>;
}

interface UnderlyingSinkStartCallback {
	(controller: WritableStreamDefaultController): any;
}

interface UnderlyingSinkWriteCallback<W> {
	(chunk: W, controller: WritableStreamDefaultController): void | PromiseLike<void>;
}

interface UnderlyingSource<R = any> {
	autoAllocateChunkSize?: number;
	cancel?: UnderlyingSourceCancelCallback;
	pull?: UnderlyingSourcePullCallback<R>;
	start?: UnderlyingSourceStartCallback<R>;
	type?: ReadableStreamType;
}

interface UnderlyingSourceCancelCallback {
	(reason?: any): void | PromiseLike<void>;
}

interface UnderlyingSourcePullCallback<R> {
	(controller: ReadableStreamController<R>): void | PromiseLike<void>;
}

interface UnderlyingSourceStartCallback<R> {
	(controller: ReadableStreamController<R>): any;
}

interface VoidFunction {
	(): void;
}

interface WritableStream<W = any> {
	readonly locked: boolean;
	abort(reason?: any): Promise<void>;
	close(): Promise<void>;
	getWriter(): WritableStreamDefaultWriter<W>;
}

interface WritableStreamDefaultController {
	readonly signal: AbortSignal;
	error(e?: any): void;
}

interface WritableStreamDefaultWriter<W = any> {
	readonly closed: Promise<void>;
	readonly desiredSize: number | null;
	readonly ready: Promise<void>;
	abort(reason?: any): Promise<void>;
	close(): Promise<void>;
	releaseLock(): void;
	write(chunk?: W): Promise<void>;
}

type XMLHttpRequestBodyInit = Blob | BufferSource | FormData | URLSearchParams | string;
