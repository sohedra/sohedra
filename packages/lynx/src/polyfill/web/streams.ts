// The streams family: the Streams Standard § 4–7 (readable, writable and transform streams, their
// readers, writers and controllers, the queuing strategies), by web-streams-polyfill, as Expo's.
// Background only: `fetch`'s bodies are its streams. lynx-core's `ReadableStream` is a receiver for
// `fetch`'s chunks that an app can't use (one made with `new` never gives what it was given, and it
// has no `pipeThrough` or `tee`), so the whole family is replaced together. Leaves out what the
// package leaves out: transferring a stream to another thread.

import type { Scope } from "../globals.ts";
import { holds, installLazy } from "../install.ts";
import * as streams from "../vendor/streams.js";
import type { ReadableStreamClass } from "./standard-classes.ts";

/** @workaround web-streams kind=lynx-gap delete-when="Lynx's background thread has a ReadableStream that reads what it was given, and the rest of the streams family" */
export function fillStreams(scope: Scope): void {
	if (reads(scope["ReadableStream"]) && typeof scope["TransformStream"] === "function") return;
	for (const [name, value] of Object.entries(streams)) installLazy(scope, name, () => value, never);
}

const never = (): boolean => false;

/** Whether `existing` is a `ReadableStream` that takes its source's chunks and pipes. */
function reads(existing: unknown): boolean {
	if (typeof existing !== "function") return false;
	return holds(() => {
		let controller: ReadableStreamDefaultController | undefined;
		// Boundary: the thread's own, checked as the standard one.
		new (existing as ReadableStreamClass)({
			start(given) {
				controller = given;
			},
		});
		const prototype = (existing as ReadableStreamClass).prototype;
		return (
			typeof controller?.enqueue === "function" &&
			typeof prototype.pipeThrough === "function" &&
			typeof prototype.tee === "function"
		);
	});
}
