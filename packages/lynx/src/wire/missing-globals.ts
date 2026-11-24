// What a page's error says when its code read a global Lynx's engine doesn't have: the engine's
// own `ReferenceError` names only the global, so the report names the import of
// `@sohedra/lynx-polyfill` that fills it, or, for what no fill gives, what to use instead. The binding
// imports nothing of the package: this is a table of names.

import { wireMessage } from "./catalogue.ts";

const POLYFILL = "@sohedra/lynx-polyfill";

/** Each global a subpath of @sohedra/lynx-polyfill fills, by subpath. */
const FILLED: Readonly<Record<string, readonly string[]>> = {
	"": ["self", "navigator"],
	"/events": [
		"Event",
		"EventTarget",
		"CustomEvent",
		"ErrorEvent",
		"PromiseRejectionEvent",
		"DOMException",
		"reportError",
		"addEventListener",
		"removeEventListener",
		"dispatchEvent",
	],
	"/abort": ["AbortController", "AbortSignal"],
	"/base64": ["atob", "btoa"],
	"/encoding": ["TextEncoder", "TextDecoder"],
	"/url": ["URL", "URLSearchParams"],
	"/performance": [
		"performance",
		"Performance",
		"PerformanceEntry",
		"PerformanceMark",
		"PerformanceMeasure",
	],
	"/streams": [
		"ReadableStream",
		"ReadableStreamDefaultReader",
		"ReadableStreamBYOBReader",
		"WritableStream",
		"WritableStreamDefaultWriter",
		"TransformStream",
		"ByteLengthQueuingStrategy",
		"CountQueuingStrategy",
		"TextEncoderStream",
		"TextDecoderStream",
	],
	"/fetch": ["fetch", "Headers", "Request", "Response", "Blob", "File", "FormData"],
	"/event-source": ["EventSource"],
	"/compression": ["CompressionStream", "DecompressionStream"],
	"/url-pattern": ["URLPattern"],
	"/messaging": ["MessageChannel", "MessagePort", "MessageEvent"],
	"/iterator-helpers": ["Iterator"],
};

/** What to use instead of each global no fill gives. */
const NOT_ON_LYNX: Readonly<Record<string, string>> = {
	crypto:
		"For hashes, use a library in plain JavaScript such as @noble/hashes. Lynx has no secure source of random numbers in JavaScript: generate keys and tokens on a server or in a native module.",
	Intl: "Format dates and numbers with a library in plain JavaScript, such as date-fns or dayjs; the locale methods (`toLocaleString` and the like) give fixed English output.",
	WebAssembly:
		"Run that code on a server, or port it to JavaScript or a native module: Lynx's engines run no WebAssembly.",
	WebSocket:
		"Use a native module of the host app that gives a socket, or a server that sends events over `fetch` (`@sohedra/lynx-polyfill/event-source`).",
	matchMedia:
		"Read the screen from the global `SystemInfo` (`pixelWidth`, `pixelHeight`, `pixelRatio`): Lynx has no media queries in JavaScript.",
	localStorage:
		"Keep data with a native storage module of the host app: Lynx has no storage in JavaScript.",
};

/** The global an engine's `ReferenceError` says is missing: V8's and PrimJS's, and JavaScriptCore's. */
const NOT_DEFINED = /^(?:([\w$]+) is not defined|Can't find variable: ([\w$]+))$/;

/**
 * The page's error as it should be reported: for a `ReferenceError` naming a global that a fill gives
 * or that Lynx lacks for good, a `ReferenceError` whose message says so and what to do, with the
 * original's stack and the original as its `cause`. Anything else as it is.
 */
export function withMissingGlobalHint(error: unknown): unknown {
	if (!(error instanceof ReferenceError)) return error;
	const match = NOT_DEFINED.exec(error.message);
	const name = match?.[1] ?? match?.[2];
	if (name === undefined) return error;
	let text: string | undefined;
	const instead = NOT_ON_LYNX[name];
	if (instead !== undefined)
		text = wireMessage({ code: "global_not_on_lynx", details: { name, instead } });
	else
		for (const [subpath, names] of Object.entries(FILLED))
			if (names.includes(name))
				text = wireMessage({
					code: "global_not_filled",
					details: { name, module: `${POLYFILL}${subpath}` },
				});
	if (text === undefined) return error;
	const hinted = new ReferenceError(text, { cause: error });
	if (typeof error.stack === "string")
		hinted.stack = `ReferenceError: ${text}\n${stackFrames(error.stack)}`;
	return hinted;
}

/** The frames of a stack, without the line of its message that V8 puts first. */
function stackFrames(stack: string): string {
	const lines = stack.split("\n");
	return (lines[0]!.startsWith("ReferenceError") ? lines.slice(1) : lines).join("\n");
}
