// `fetch`, `Request` and `Response`: the Fetch Standard § 5.3 "Request class", § 5.5 "Response
// class" and § 5.6 "Fetch method", over lynx-core's `fetch` (lynx/lynx.ts), which sends the request
// through Lynx's native fetch module. With `Headers` (headers.ts) and the Body mixin (body.ts).
//
// lynx-core's own family gets much wrong: `Headers` minds case, a second read of a body gives
// `undefined` (not the standard's `TypeError`), there is no `blob()`, `formData()` or
// `Response.json()`, a body can't be a `Blob` or `FormData`, and its `response.body` is a stream an
// app can't pipe. This family replaces it on the background, and the request goes through
// lynx-core's `fetch` all the same: it makes the page global's `Request` and `Response` as it goes,
// so while a request waits, this `Request` hands lynx-core its own, and this `Response` takes what
// lynx-core gives it (the response's head and its body: the bytes, or the stream Lynx feeds when the
// page config's `enableFetchAPIStandardStreaming` is on).
//
// Leaves out: redirects are the native module's, so `redirected` is always `false` and `redirect`
// does nothing; CORS, credentials, the cache and `keepalive` mean nothing without a browser, so their
// options are kept and do nothing; an upload is read whole before it is sent (lynx-core takes bytes);
// lynx-core adds `Content-Type: text/plain;charset=UTF-8` to a request without a body; a request
// without a `User-Agent` gets the native module's own, which names the app and the system. On the main
// thread, where there is no native fetch, `Headers`, `Request` and `Response` are there (code shared
// with the first frame may make them) and `fetch` throws the folder's `fetch_on_main_thread`.

import { polyfillError } from "../catalogue.ts";
import type { Scope, ThreadLynx } from "../globals.ts";
import { holds, installEager, installLazy, named } from "../install.ts";
import { Body, defineBodyMixin, extractBody, isReadableStream } from "./body.ts";
import type { Puller } from "./body.ts";
import { createHeaders, TOKEN } from "./headers.ts";
import { record } from "./record.ts";
import type {
	AbortControllerClass,
	AbortSignalClass,
	FetchFunction,
	HeadersClass,
	RequestClass,
	ResponseClass,
	URLClass,
} from "./standard-classes.ts";

/** @workaround web-fetch kind=lynx-bug delete-when="lynx-core's fetch, Headers, Request and Response follow the Fetch Standard: case-insensitive headers, a TypeError for a body read twice, blob(), formData(), Response.json(), Blob and FormData bodies, and a streaming body that is a ReadableStream" */
export function fillFetch(scope: Scope, readLynx: () => ThreadLynx): void {
	if (follows(scope)) return;
	// Boundary: lynx-core's own classes, which its `fetch` makes while a request waits.
	const core = { Request: scope["Request"], Response: scope["Response"] } as CoreClasses;
	const made = createFetch(scope, readLynx, core);
	for (const name of ["Headers", "Request", "Response"] as const)
		installEager(scope, name, made[name], never);
	installEager(scope, "fetch", made.fetch, never);
}

/** @workaround web-fetch-main-thread kind=lynx-limit delete-when="Lynx's main thread can fetch" */
export function fillMainThreadFetch(scope: Scope): void {
	let made: ReturnType<typeof createFetch> | undefined;
	const make = () => (made ??= createFetch(scope, () => ({ reportError() {} })));
	for (const name of ["Headers", "Request", "Response"] as const)
		installLazy(scope, name, () => make()[name], isFunction);
	installLazy(scope, "fetch", () => fetchOnMainThread, isFunction);
}

const never = (): boolean => false;
const isFunction = (existing: unknown): boolean => typeof existing === "function";

/** The main thread's `fetch`: an error that says where fetch runs. */
function fetchOnMainThread(): never {
	throw polyfillError("fetch_on_main_thread", {});
}

/** Whether the thread's family follows the standard where lynx-core's does not. */
function follows(scope: Scope): boolean {
	// Boundary: the thread's own, checked as the standard ones.
	const HeadersClass = scope["Headers"] as HeadersClass | undefined;
	const ResponseClass = scope["Response"] as ResponseClass | undefined;
	return (
		typeof scope["fetch"] === "function" &&
		typeof scope["Request"] === "function" &&
		typeof HeadersClass === "function" &&
		typeof ResponseClass === "function" &&
		typeof ResponseClass.json === "function" &&
		typeof ResponseClass.prototype.blob === "function" &&
		typeof ResponseClass.prototype.formData === "function" &&
		holds(() => new HeadersClass({ "A-B": "1" }).get("a-b") === "1")
	);
}

/** lynx-core's `Request` and `Response`, as its `fetch` makes them. */
interface CoreClasses {
	Request?: new (input: unknown, init: unknown) => object;
	Response?: unknown;
}

/** lynx-core's stream for a body that streams (modules/fetch/ReadableStream.ts). */
interface CoreStream {
	getReader(): {
		read(): Promise<{ done: boolean; value?: ArrayBuffer }>;
		cancel(reason?: unknown): unknown;
	} | null;
	cancel(reason?: unknown): unknown;
	onData(data: ArrayBuffer): void;
}

/** The head of a response, as the native module gives it to lynx-core's `Response`. */
interface NativeHead {
	status?: number;
	statusText?: string;
	url?: string;
	headers?: Record<string, unknown>;
	lynxExtension?: Record<string, unknown>;
}

/** Whether `value` is lynx-core's stream for a body, which Lynx feeds. */
function isCoreStream(value: unknown): value is CoreStream {
	return (
		typeof value === "object" &&
		value !== null &&
		typeof (value as CoreStream).getReader === "function" &&
		typeof (value as CoreStream).onData === "function"
	);
}

/** A puller over lynx-core's stream, which an abort rejects at once and cancels. */
function corePuller(stream: CoreStream): Puller & { abort(reason: unknown): void } {
	let reader: ReturnType<CoreStream["getReader"]> | undefined;
	let aborted: { reason: unknown } | undefined;
	let waiting: ((reason: unknown) => void) | undefined;
	return {
		read() {
			if (aborted) return Promise.reject(aborted.reason);
			reader ??= stream.getReader();
			const held = reader;
			if (!held)
				return Promise.reject(new TypeError("The response's body was already being read."));
			return new Promise((resolve, reject) => {
				waiting = reject;
				held.read().then(
					({ done, value }) => {
						waiting = undefined;
						resolve(
							done
								? record({ done: true })
								: record({ done: false, value: new Uint8Array(value!) }),
						);
					},
					(error: unknown) => {
						waiting = undefined;
						reject(
							new TypeError(`The response's body broke off: ${(error as Error)?.message ?? error}`),
						);
					},
				);
			});
		},
		cancel: (reason) => stream.cancel(reason),
		abort(reason) {
			if (aborted) return;
			aborted = { reason };
			waiting?.(reason);
			void stream.cancel(reason);
		},
	};
}

const METHODS = ["DELETE", "GET", "HEAD", "OPTIONS", "POST", "PUT"];
const FORBIDDEN_METHODS = ["CONNECT", "TRACE", "TRACK"];
const NULL_BODY_STATUSES = [101, 103, 204, 205, 304];
const REDIRECT_STATUSES = [301, 302, 303, 307, 308];
/** HTTP's `reason-phrase`. */
const REASON_PHRASE = /^[\t\x20-\x7E\x80-\xFF]*$/;

/** The options of a request the standard checks, with their values and defaults. */
const REQUEST_OPTIONS = {
	mode: ["cors", ["same-origin", "no-cors", "cors"]],
	credentials: ["same-origin", ["omit", "same-origin", "include"]],
	cache: [
		"default",
		["default", "no-store", "reload", "no-cache", "force-cache", "only-if-cached"],
	],
	redirect: ["follow", ["follow", "error", "manual"]],
} as const;

type RequestOption = keyof typeof REQUEST_OPTIONS;

/** What a request holds. */
interface RequestState {
	url: string;
	method: string;
	headers: Headers;
	signal: AbortSignal | null;
	body: Body | null;
	options: Record<RequestOption, string> & {
		referrer: string;
		integrity: string;
		keepalive: boolean;
	};
}

/** What a response holds. */
interface ResponseState {
	type: ResponseType;
	url: string;
	status: number;
	statusText: string;
	headers: Headers;
	body: Body | null;
}

/** The thread's `Headers`, `Request`, `Response` and `fetch`, over `readLynx().fetch`. */
export function createFetch(
	scope: Scope,
	readLynx: () => ThreadLynx,
	core: CoreClasses = {},
): {
	Headers: HeadersClass;
	Request: RequestClass;
	Response: ResponseClass;
	fetch: FetchFunction;
} {
	const { Headers: HeadersClass, freeze } = createHeaders();
	const requests = new WeakMap<object, RequestState>();
	const responses = new WeakMap<object, ResponseState>();
	/** The pullers of fetched responses' bodies, which an abort stops. */
	const pullers = new WeakMap<object, ReturnType<typeof corePuller>>();
	/**
	 * The signal each puller follows, held while the puller is: `AbortSignal.any` holds a request's
	 * signal weakly, and an abort must still reach a body being read.
	 */
	const followed = new WeakMap<object, AbortSignal>();
	/** Whether lynx-core's `fetch` is making its request: `new Request` gives it lynx-core's own. */
	let coreCalling = false;
	/** How many requests wait for lynx-core's answer: until then, it may make a `Response`. */
	let waiting = 0;
	/** A state for the next construction, to make a request or response from one (clone, statics). */
	let building: RequestState | ResponseState | undefined;

	const requestOf = (value: unknown): RequestState => {
		const state = typeof value === "object" && value !== null ? requests.get(value) : undefined;
		if (!state) throw new TypeError("Illegal invocation: not a Request.");
		return state;
	};
	const responseOf = (value: unknown): ResponseState => {
		const state = typeof value === "object" && value !== null ? responses.get(value) : undefined;
		if (!state) throw new TypeError("Illegal invocation: not a Response.");
		return state;
	};

	/** A URL as the standard parses a request's: absolute, without credentials. */
	const parseUrl = (input: unknown, what: string): string => {
		const text = `${input as string}`;
		// Boundary: the thread's `URL`, which this folder fills on both threads.
		const UrlClass = scope["URL"] as URLClass | undefined;
		if (typeof UrlClass !== "function") return text;
		let url: URL;
		try {
			url = new UrlClass(text);
		} catch {
			throw new TypeError(
				`${what} takes an absolute URL, and "${text}" is not one: Lynx has no page address to resolve it against.`,
			);
		}
		if (url.username !== "" || url.password !== "")
			throw new TypeError(
				`${what} can't take a URL with a user name or password: send them in a header.`,
			);
		return url.href;
	};

	const newSignal = (given: AbortSignal | null | undefined): AbortSignal | null => {
		// Boundary: the thread's `AbortSignal` and `AbortController`, which this folder fills.
		const SignalClass = scope["AbortSignal"] as AbortSignalClass | undefined;
		if (given && typeof SignalClass?.any === "function") return SignalClass.any([given]);
		if (given) return given;
		const Controller = scope["AbortController"] as AbortControllerClass | undefined;
		return typeof Controller === "function" ? new Controller().signal : null;
	};

	class RequestFill {
		constructor(input: RequestInfo | URL, init: RequestInit = {}) {
			if (coreCalling && typeof core.Request === "function")
				// lynx-core's `fetch` makes its own request from the one this fill hands it.
				return new core.Request(input, init) as RequestFill;
			if (building) {
				requests.set(this, building as RequestState);
				building = undefined;
				return;
			}
			const given = init ?? {};
			const base =
				typeof input === "object" && input !== null && requests.has(input)
					? requests.get(input)!
					: undefined;
			const url = base ? base.url : parseUrl(input, "Request");
			let method = base ? base.method : "GET";
			if (given.method !== undefined) {
				method = `${given.method}`;
				if (!TOKEN.test(method)) throw new TypeError(`"${method}" is not an HTTP method.`);
				const upper = method.toUpperCase();
				if (FORBIDDEN_METHODS.includes(upper))
					throw new TypeError(`Lynx can't send a ${upper} request.`);
				if (METHODS.includes(upper)) method = upper;
			}
			const options = { ...(base?.options ?? defaultOptions()) };
			for (const key of Object.keys(REQUEST_OPTIONS) as RequestOption[]) {
				const value = given[key];
				if (value === undefined) continue;
				const allowed: readonly string[] = REQUEST_OPTIONS[key][1];
				if (!allowed.includes(`${value}`))
					throw new TypeError(`"${value}" is not a request's ${key}.`);
				options[key] = `${value}`;
			}
			if (options.mode === "navigate") throw new TypeError("A request's mode can't be navigate.");
			if (given.referrer !== undefined) options.referrer = `${given.referrer}`;
			if (given.integrity !== undefined) options.integrity = `${given.integrity}`;
			if (given.keepalive !== undefined) options.keepalive = Boolean(given.keepalive);
			const headers = new HeadersClass(given.headers ?? base?.headers);
			const signal = newSignal(given.signal === undefined ? base?.signal : given.signal);
			const hasBody = given.body !== undefined && given.body !== null;
			if (
				(hasBody || (base?.body && given.body === undefined)) &&
				(method === "GET" || method === "HEAD")
			)
				throw new TypeError(`A ${method} request can't have a body.`);
			let body: Body | null = null;
			if (hasBody) {
				if (isReadableStream(given.body) && (given as { duplex?: string }).duplex !== "half")
					throw new TypeError('A request whose body is a stream needs `duplex: "half"`.');
				const { source, type } = extractBody(scope, given.body);
				body = new Body(scope, source);
				if (type !== null && !headers.has("content-type")) headers.append("content-type", type);
			} else if (base?.body && given.body === undefined) body = base.body.transfer();
			requests.set(this, { url, method, headers, signal, body, options });
		}

		get url(): string {
			return requestOf(this).url;
		}

		get method(): string {
			return requestOf(this).method;
		}

		get headers(): Headers {
			return requestOf(this).headers;
		}

		get signal(): AbortSignal | null {
			return requestOf(this).signal;
		}

		get mode(): string {
			return requestOf(this).options.mode;
		}

		get credentials(): string {
			return requestOf(this).options.credentials;
		}

		get cache(): string {
			return requestOf(this).options.cache;
		}

		get redirect(): string {
			return requestOf(this).options.redirect;
		}

		get referrer(): string {
			return requestOf(this).options.referrer;
		}

		get referrerPolicy(): string {
			return "";
		}

		get integrity(): string {
			return requestOf(this).options.integrity;
		}

		get keepalive(): boolean {
			return requestOf(this).options.keepalive;
		}

		get destination(): string {
			return "";
		}

		get duplex(): string {
			return "half";
		}

		clone(): RequestFill {
			const state = requestOf(this);
			let body: Body | null = null;
			if (state.body) [state.body, body] = state.body.clone();
			building = {
				...state,
				headers: new HeadersClass(state.headers),
				signal: newSignal(state.signal),
				body,
			};
			return new RequestFill("");
		}
	}

	class ResponseFill {
		constructor(body?: BodyInit | null, init: ResponseInit = {}, ...lynxCore: unknown[]) {
			if (building) {
				responses.set(this, building as ResponseState);
				building = undefined;
				return;
			}
			if (waiting > 0 && lynxCore.length > 0) {
				// lynx-core's `fetch` makes the response: its head, and its body or the stream for it.
				const head = (init ?? {}) as NativeHead;
				const status = head.status ?? 200;
				if (status < 200 || status > 599)
					throw new RangeError(`Lynx answered with status ${status}.`);
				const headers = new HeadersClass();
				for (const [name, value] of Object.entries(head.headers ?? {}))
					try {
						headers.append(name, `${value as string}`);
					} catch {
						// A header HTTP refuses is left out, as a browser leaves it.
					}
				let source;
				if (isCoreStream(body)) {
					const puller = corePuller(body);
					pullers.set(this, puller);
					source = { open: () => puller };
				} else
					source =
						body === undefined || body === null
							? { bytes: new Uint8Array(0) }
							: extractBody(scope, body).source;
				responses.set(this, {
					type: "basic",
					url: head.url ?? "",
					status,
					statusText: `${head.statusText ?? ""}`,
					headers: freeze(headers),
					body: NULL_BODY_STATUSES.includes(status) ? null : new Body(scope, source),
				});
				// lynx-core reads the response's id for its stream here.
				Object.defineProperty(this, "lynxExtension", {
					value: head.lynxExtension ?? {},
					configurable: true,
				});
				return;
			}
			const given = init ?? {};
			const status = given.status === undefined ? 200 : Math.trunc(Number(given.status));
			if (!(status >= 200 && status <= 599))
				throw new RangeError(
					`A Response's status runs from 200 to 599, and ${given.status} was given.`,
				);
			const statusText = given.statusText === undefined ? "" : `${given.statusText}`;
			if (!REASON_PHRASE.test(statusText))
				throw new TypeError(`"${statusText}" is not a status text HTTP allows.`);
			const headers = new HeadersClass(given.headers);
			let made: Body | null = null;
			if (body !== undefined && body !== null) {
				if (NULL_BODY_STATUSES.includes(status))
					throw new TypeError(`A response with status ${status} can't have a body.`);
				const { source, type } = extractBody(scope, body);
				made = new Body(scope, source);
				if (type !== null && !headers.has("content-type")) headers.append("content-type", type);
			}
			responses.set(this, { type: "default", url: "", status, statusText, headers, body: made });
		}

		get type(): ResponseType {
			return responseOf(this).type;
		}

		get url(): string {
			return responseOf(this).url;
		}

		get redirected(): boolean {
			return false;
		}

		get status(): number {
			return responseOf(this).status;
		}

		get ok(): boolean {
			const { status } = responseOf(this);
			return status >= 200 && status <= 299;
		}

		get statusText(): string {
			return responseOf(this).statusText;
		}

		get headers(): Headers {
			return responseOf(this).headers;
		}

		clone(): ResponseFill {
			const state = responseOf(this);
			let body: Body | null = null;
			if (state.body) [state.body, body] = state.body.clone();
			const headers = new HeadersClass(state.headers);
			building = { ...state, headers: state.type === "default" ? headers : freeze(headers), body };
			return new ResponseFill();
		}

		static error(): ResponseFill {
			building = {
				type: "error",
				url: "",
				status: 0,
				statusText: "",
				headers: freeze(new HeadersClass()),
				body: null,
			};
			return new ResponseFill();
		}

		static redirect(url: string | URL, status: number = 302): ResponseFill {
			const location = parseUrl(url, "Response.redirect");
			if (!REDIRECT_STATUSES.includes(status))
				throw new RangeError(
					`Response.redirect takes a redirect status (301, 302, 303, 307 or 308), and ${status} was given.`,
				);
			building = {
				type: "default",
				url: "",
				status,
				statusText: "",
				headers: freeze(new HeadersClass({ location })),
				body: null,
			};
			return new ResponseFill();
		}

		static json(data: unknown, init: ResponseInit = {}): ResponseFill {
			const text = JSON.stringify(data) as string | undefined;
			if (text === undefined)
				throw new TypeError("Response.json was given a value JSON can't hold.");
			const response = new ResponseFill(text, init);
			const { headers } = responseOf(response);
			// The body's type is JSON's unless the init's headers name one (the text body set
			// `text/plain` as the response was made).
			if (!new HeadersClass(init.headers).has("content-type"))
				headers.set("content-type", "application/json");
			return response;
		}
	}

	defineBodyMixin(RequestFill.prototype, scope, (owner) => requestOf(owner));
	defineBodyMixin(ResponseFill.prototype, scope, (owner) => responseOf(owner));

	/** A response lynx-core made of its own class, read whole into this fill's. */
	const adopt = (answer: unknown): ResponseFill => {
		// Boundary: lynx-core's `Response`, read as its fields are.
		const made = answer as NativeHead & {
			headers?: { entries?(): Iterable<[string, string]> };
			arrayBuffer(): Promise<ArrayBuffer | undefined>;
		};
		const headers = new HeadersClass();
		for (const [name, value] of made.headers?.entries?.() ?? [])
			try {
				headers.append(name, value);
			} catch {
				// A header HTTP refuses is left out.
			}
		building = {
			type: "basic",
			url: `${made.url ?? ""}`,
			status: made.status ?? 200,
			statusText: `${made.statusText ?? ""}`,
			headers: freeze(headers),
			body: new Body(scope, {
				load: async () =>
					record({ bytes: new Uint8Array((await made.arrayBuffer()) ?? new ArrayBuffer(0)) }),
			}),
		};
		return new ResponseFill();
	};

	function fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
		return new Promise((resolve, reject) => {
			const request = new RequestFill(input, init);
			const state = requestOf(request);
			const { signal } = state;
			if (signal?.aborted) return reject(signal.reason);
			void (state.body ? state.body.bytes() : Promise.resolve(undefined)).then((loaded) => {
				const bytes = loaded?.bytes;
				if (signal?.aborted) return reject(signal.reason);
				// No prototype: a header may be named `constructor` or `__proto__`.
				const headers = Object.create(null) as Record<string, string>;
				for (const [name, value] of state.headers)
					headers[name] = Object.prototype.hasOwnProperty.call(headers, name)
						? `${headers[name]}, ${value}`
						: value;
				const lynxFetch = readLynx().fetch;
				if (typeof lynxFetch !== "function")
					return reject(new TypeError("fetch needs Lynx's fetch, which this thread lacks."));
				let answer: PromiseLike<unknown>;
				waiting++;
				coreCalling = true;
				try {
					answer = lynxFetch(state.url, {
						method: state.method,
						headers,
						...(bytes && {
							body: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
						}),
						...(signal && { signal }),
					});
				} catch (error) {
					waiting--;
					return reject(error);
				} finally {
					coreCalling = false;
				}
				answer.then(
					(made) => {
						waiting--;
						const response = responses.has(made as object) ? (made as ResponseFill) : adopt(made);
						const puller = pullers.get(response);
						if (puller && signal) {
							if (signal.aborted) puller.abort(signal.reason);
							else {
								followed.set(puller, signal);
								signal.addEventListener("abort", () => puller.abort(signal.reason), { once: true });
							}
						}
						resolve(response as unknown as Response);
					},
					(error: unknown) => {
						waiting--;
						reject(error);
					},
				);
			}, reject);
		});
	}

	return {
		// Boundary: the classes above, as TypeScript's DOM library types them.
		Headers: HeadersClass,
		Request: named(RequestFill, "Request") as unknown as RequestClass,
		Response: named(ResponseFill, "Response") as unknown as ResponseClass,
		fetch: fetch as FetchFunction,
	};
}

/** A request's options the standard defaults. */
function defaultOptions(): RequestState["options"] {
	return {
		mode: REQUEST_OPTIONS.mode[0],
		credentials: REQUEST_OPTIONS.credentials[0],
		cache: REQUEST_OPTIONS.cache[0],
		redirect: REQUEST_OPTIONS.redirect[0],
		referrer: "about:client",
		integrity: "",
		keepalive: false,
	};
}
