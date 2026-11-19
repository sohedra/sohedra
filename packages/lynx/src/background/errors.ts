// The page's `onError`: every error the binding reports into Lynx, on either thread, reaches it once,
// with where it came from. Lynx's own catches (a timer's callback, a rejection nobody handled) go to
// the host and not here: Lynx gives them to no JavaScript hook.

import { docsLink } from "../wire/index.ts";
import type { Thread } from "../wire/index.ts";
import { background } from "./globals.ts";

/** What `onError` is told about an error, beside the error. */
export interface ErrorContext {
	/** The thread it was thrown on. */
	thread: Thread;
	/**
	 * The component it came from, as its file's name (`Card.svelte`), when a development build says:
	 * Svelte's own lines under the message of an error that left an effect, or the element whose
	 * handler or main-thread function threw. A production build has none.
	 */
	component: string | undefined;
	/** The binding's stable code (`hydration_mismatch`), when the binding wrote the error. */
	code: string | undefined;
}

/** A page's `onError`. */
export type ErrorHandler = (error: Error, context: ErrorContext) => void;

/** What is known of where an error came from, beside its text. */
export interface ErrorSource {
	/** The element whose handler or main-thread function threw. */
	node?: object | undefined;
	/** The component, as the thread that threw it knew it. */
	component?: string | undefined;
}

/** Names the component an error came from: the page gives it, with Svelte's development records. */
export type ComponentOf = (error: Error, source: ErrorSource) => string | undefined;

let handler: ErrorHandler | undefined;
/** Which page set the handler: a page that ended lets go only of its own. */
let owner: object = {};
let componentOf: ComponentOf = (_error, source) => source.component;
/** `onError` is running: an error it causes is reported into Lynx, and does not call it again. */
let running = false;
/** Svelte threw while it mounted, flushed or ran effects, since the page started or reloaded. */
let crashed = false;

/**
 * The page's `onError` from now on, and how it names components. This module loads before Svelte's
 * runtime (the background's start-up fills in a function that reports), so it reads none of
 * Svelte's records itself.
 */
export function setErrorHandler(next: ErrorHandler | undefined, names?: ComponentOf): object {
	handler = next;
	if (names) componentOf = names;
	crashed = false;
	owner = {};
	return owner;
}

/**
 * The page whose `setErrorHandler` answered `ended` has ended: its `onError` hears nothing more. A
 * page started since keeps its own.
 */
export function releaseErrorHandler(ended: object): void {
	if (owner === ended) handler = undefined;
}

/** The page starts again (a reload): Svelte has thrown nothing on it yet. */
export function startOver(): void {
	crashed = false;
}

/**
 * Runs Svelte's mount or flush, or a microtask, from which Svelte runs the effects of a change made
 * in a timer or a promise. What it throws is thrown on, and marks the page as crashed: Svelte leaves
 * what threw broken, and a hot update does not mount it again. What the app reports, a handler's
 * own throw and the binding's own reports leave the mark alone.
 */
export function runSvelte<T>(run: () => T): T {
	try {
		return run();
	} catch (error) {
		crashed = true;
		throw error;
	}
}

/** Whether Svelte threw while it mounted, flushed or ran effects, since the page started or reloaded. */
export function crashedSinceStart(): boolean {
	return crashed;
}

/**
 * The binding's code of `error`, when the binding wrote it: every message of its catalogues ends
 * with the docs link of its code. An app's or a library's own `code` is not the binding's.
 */
function codeOf(error: Error): string | undefined {
	const code = (error as { code?: unknown }).code;
	if (typeof code !== "string" || typeof error.message !== "string") return undefined;
	return error.message.includes(docsLink(code)) ? code : undefined;
}

/**
 * Tells the page's `onError` of an error already reported into Lynx. What `onError` throws is
 * reported into Lynx once, and goes no further.
 */
export function heard(error: Error, thread: Thread, source: ErrorSource = {}): void {
	if (!handler || running) return;
	const component = componentOf(error, source);
	running = true;
	try {
		handler(error, { thread, component, code: codeOf(error) });
	} catch (thrown) {
		try {
			background.lynx.reportError(thrown);
		} catch {
			// Reporting must never throw over the error.
		}
	} finally {
		running = false;
	}
}
