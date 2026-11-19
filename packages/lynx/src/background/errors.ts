// The page's `onError`: every error the binding reports into Lynx, on either thread, reaches it once,
// with where it came from. Lynx's own catches (a timer's callback, a rejection nobody handled) go to
// the host and not here: Lynx gives them to no JavaScript hook.

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
let componentOf: ComponentOf = (_error, source) => source.component;
/** `onError` is running: an error it causes is reported into Lynx, and does not call it again. */
let running = false;
/** An error was reported since the page started or reloaded. */
let crashed = false;

/** `error` as an `Error`: a thrown value that is not one is wrapped, with the value as its text. */
export function asError(error: unknown): Error {
	return error instanceof Error ? error : new Error(String(error));
}

/**
 * The page's `onError` from now on, and how it names components; `undefined` once the page has
 * ended. This module loads before Svelte's runtime (the background's start-up fills in a function
 * that reports), so it reads none of Svelte's records itself.
 */
export function setErrorHandler(next: ErrorHandler | undefined, names?: ComponentOf): void {
	handler = next;
	if (names) componentOf = names;
	crashed = false;
}

/** The page starts again (a reload): no error has been reported on it yet. */
export function startOver(): void {
	crashed = false;
}

/** Whether an error was reported since the page started or last reloaded. */
export function crashedSinceStart(): boolean {
	return crashed;
}

/** The binding's code of `error`, when it is one of its messages. */
function codeOf(error: Error): string | undefined {
	const code = (error as { code?: unknown }).code;
	return typeof code === "string" ? code : undefined;
}

/**
 * Tells the page's `onError` of an error already reported into Lynx. What `onError` throws is
 * reported into Lynx once, and goes no further.
 */
export function heard(error: Error, thread: Thread, source: ErrorSource = {}): void {
	crashed = true;
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
