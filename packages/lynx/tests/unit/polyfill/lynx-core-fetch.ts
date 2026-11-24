// lynx-core's `fetch` and the classes it puts on the background's global object, reduced to what
// they do with the values they are given, as lynx-core 423fb8fcc writes them
// (js_libraries/lynx-core/src/lynx/lynx.ts `fetch`, modules/fetch/Request.ts, Response.ts,
// BodyMixin.ts, Headers.ts, ReadableStream.ts, app/app.ts `setupFetchAPI`). The native fetch module
// is the test's: it answers each request as the test says.

/** What lynx-core hands the native module (lynx.ts, `fetchArg`). */
export interface NativeRequest {
	method: string;
	url: string;
	headers: Record<string, string>;
	body: ArrayBuffer | null;
	lynxExtension: Record<string, unknown>;
}

/** What the native module answers with: the response's head, and its body unless it streams. */
export interface NativeResponse {
	status: number;
	statusText?: string;
	url?: string;
	headers?: Record<string, string>;
	body?: ArrayBuffer;
	lynxExtension?: Record<string, unknown>;
}

/** `instanceof ArrayBuffer` in any realm: the test page's globals and Node's differ. */
function isArrayBuffer(value: unknown): value is ArrayBuffer {
	return Object.prototype.toString.call(value) === "[object ArrayBuffer]";
}

/** lynx-core's case-sensitive `Headers` (mswjs/headers-polyfill, trimmed by lynx-core). */
export class CoreHeaders {
	readonly map: Map<string, string> = new Map();

	constructor(init?: Record<string, string> | CoreHeaders) {
		if (init instanceof CoreHeaders) for (const [key, value] of init.map) this.map.set(key, value);
		else if (init)
			for (const name of Object.getOwnPropertyNames(init)) this.map.set(name, init[name]!);
	}

	get(name: string): string | null {
		return this.map.get(name) ?? null;
	}

	set(name: string, value: string): void {
		this.map.set(name, String(value));
	}

	entries(): IterableIterator<[string, string]> {
		return this.map.entries();
	}
}

/** lynx-core's `AbortSignal.__create()` for a request given none: never aborted. */
const quietSignal = {
	aborted: false,
	reason: undefined,
	addEventListener() {},
};

/** lynx-core's `Request`: what its `fetch` reads of one. */
export class CoreRequest {
	url: string;
	method: string;
	headers: CoreHeaders;
	signal: {
		aborted: boolean;
		reason: unknown;
		addEventListener(type: string, listener: () => void): void;
	};
	lynxExtension: Record<string, unknown>;
	_arrayBuffer: ArrayBuffer;

	constructor(
		input: unknown,
		options: {
			method?: string;
			headers?: Record<string, string>;
			body?: unknown;
			signal?: CoreRequest["signal"];
			lynxExtension?: Record<string, unknown>;
		} = {},
	) {
		this.url = String(input);
		this.headers = new CoreHeaders(options.headers);
		this.method = (options.method || "GET").toUpperCase();
		if ((this.method === "GET" || this.method === "HEAD") && options.body)
			throw new TypeError("Body not allowed for GET or HEAD requests");
		this.signal = options.signal ?? quietSignal;
		this.lynxExtension = options.lynxExtension ?? {};
		if (!this.headers.get("Content-Type")) {
			if (typeof options.body === "string")
				this.headers.set("Content-Type", "text/plain;charset=UTF-8");
			else if (!isArrayBuffer(options.body))
				this.headers.set("Content-Type", "text/plain;charset=UTF-8");
		}
		this._arrayBuffer = isArrayBuffer(options.body)
			? options.body.slice(0)
			: new TextEncoder().encode(options.body === undefined ? "" : String(options.body as string))
					.buffer;
	}
}

/** lynx-core's stream receiver (`createReadableStreamClass`): the native module feeds it. */
export class CoreReceiver {
	private readonly chunks: ArrayBuffer[] = [];
	private done = false;
	private error: Error | undefined;
	private wake: (() => void) | undefined;
	private locked = false;
	cancelled = false;

	onData(data: ArrayBuffer): void {
		if (this.cancelled) return;
		this.chunks.push(data);
		this.wake?.();
	}

	onEnd(): void {
		this.done = true;
		this.wake?.();
	}

	onError(error: string): void {
		this.error = new Error(error);
		this.wake?.();
	}

	private read(): Promise<{ done: boolean; value: ArrayBuffer | undefined }> {
		return new Promise((resolve, reject) => {
			const process = (): void => {
				this.wake = undefined;
				if (this.error) return reject(this.error);
				if (this.cancelled || (this.done && this.chunks.length === 0))
					return resolve({ done: true, value: undefined });
				if (this.chunks.length > 0) return resolve({ done: false, value: this.chunks.shift() });
				this.wake = process;
			};
			process();
		});
	}

	cancel(reason?: unknown): Promise<unknown> {
		this.cancelled = true;
		this.wake?.();
		return Promise.resolve(reason);
	}

	getReader(): {
		read: () => Promise<{ done: boolean; value: ArrayBuffer | undefined }>;
		cancel: (reason?: unknown) => Promise<unknown>;
	} | null {
		if (this.locked) return null;
		this.locked = true;
		return { read: () => this.read(), cancel: (reason) => this.cancel(reason) };
	}
}

/** lynx-core's `Response`: its body, from the native answer or the receiver. */
export class CoreResponse {
	status: number;
	statusText: string;
	url: string;
	headers: CoreHeaders;
	lynxExtension: Record<string, unknown>;
	private bytes: ArrayBuffer;
	private stream: CoreReceiver | null = null;
	private used = false;

	constructor(body: unknown, options: NativeResponse, streaming?: boolean) {
		this.status = options.status === undefined ? 200 : options.status;
		if (this.status < 200 || this.status > 599)
			throw new RangeError(
				"Failed to construct 'Response': The status provided (0) is outside the range [200, 599].",
			);
		this.statusText = options.statusText ?? "";
		this.headers = new CoreHeaders(options.headers);
		this.url = options.url ?? "";
		this.lynxExtension = options.lynxExtension ?? {};
		this.bytes = isArrayBuffer(body) ? body.slice(0) : new ArrayBuffer(0);
		if (body instanceof CoreReceiver && streaming) this.stream = body;
	}

	async arrayBuffer(): Promise<ArrayBuffer> {
		if (this.stream) {
			const reader = this.stream.getReader()!;
			const parts: Uint8Array[] = [];
			for (;;) {
				const { done, value } = await reader.read();
				if (done) break;
				parts.push(new Uint8Array(value!));
			}
			return new Uint8Array(parts.flatMap((part) => [...part])).buffer;
		}
		if (this.used) return undefined as unknown as ArrayBuffer;
		this.used = true;
		return this.bytes;
	}
}

/** The test's native fetch module: each request, and how to answer it. */
export interface NativeFetch {
	/** The requests lynx-core handed it, in order. */
	readonly requests: NativeRequest[];
	/** Answers the request at `index` (the last by default) with a head and maybe a body. */
	respond(response: NativeResponse, index?: number): void;
	/** Fails the request at `index` (the last by default), as the native module does. */
	fail(message: string, index?: number): void;
	/** The streaming body of the request at `index` (the last by default). */
	stream(index?: number): CoreReceiver;
}

/**
 * A background's `lynx` with lynx-core's `fetch`, which builds `scope.Request` and `scope.Response`
 * as lynx-core builds its page global's, at the time it needs one. `streaming`: the page config's
 * `enableFetchAPIStandardStreaming`.
 */
export function coreLynx(
	scope: Record<string, unknown>,
	{ streaming = true }: { streaming?: boolean } = {},
): {
	lynx: {
		fetch: (input: string, init: object) => Promise<unknown>;
		reportError: (error: unknown) => void;
	};
	native: NativeFetch;
} {
	const pending: {
		request: NativeRequest;
		answer: (response: NativeResponse) => void;
		fail: (message: string) => void;
		receiver: CoreReceiver;
	}[] = [];
	const at = (index?: number) => pending[index ?? pending.length - 1]!;
	const native: NativeFetch = {
		get requests() {
			return pending.map((each) => each.request);
		},
		respond: (response, index) => at(index).answer(response),
		fail: (message, index) => at(index).fail(message),
		stream: (index) => at(index).receiver,
	};
	const fetch = (input: string, init: object): Promise<unknown> =>
		new Promise((resolve, reject) => {
			// Boundary: the page global's `Request`, lynx-core's or the fill's.
			const request = new (scope["Request"] as typeof CoreRequest)(input, init as never);
			const signal = request.signal;
			if (signal.aborted) return reject(signal.reason);
			signal.addEventListener("abort", () => reject(signal.reason));
			request.lynxExtension["enableFetchAPIStandardStreaming"] = streaming;
			const receiver = new CoreReceiver();
			pending.push({
				request: {
					method: request.method,
					url: request.url,
					headers: Object.fromEntries(request.headers.entries()),
					body: request._arrayBuffer,
					lynxExtension: request.lynxExtension,
				},
				receiver,
				answer: (response) => {
					if (signal.aborted) return;
					try {
						const made = new (scope["Response"] as typeof CoreResponse)(
							streaming ? receiver : response.body,
							response,
							streaming,
						);
						void made.lynxExtension["streamingId"];
						resolve(made);
					} catch {
						reject(new TypeError(response.statusText));
					}
				},
				fail: (message) => {
					if (signal.aborted) return;
					reject(new TypeError(message));
				},
			});
		});
	return { lynx: { fetch, reportError: () => {} }, native };
}
