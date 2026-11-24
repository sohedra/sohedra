// The types of event-source-parser.js, which scripts/polyfill/bundle.ts writes from
// eventsource-parser.

/** An event the stream finished: its `data`, and its `event` and `id` fields when it had them. */
export interface EventSourceMessage {
	data: string;
	event?: string;
	id?: string;
}

/** What the parser reports: a `retry` that is not a number, a field it doesn't know, its limit. */
export interface ParseError extends Error {
	type: "invalid-retry" | "unknown-field" | "max-buffer-size-exceeded";
}

/** What the parser calls, and its limit. */
export interface ParserConfig {
	onEvent?: (event: EventSourceMessage) => void;
	/** Each `id` field, as its event finishes. */
	onId?: (id: string) => void;
	onRetry?: (milliseconds: number) => void;
	onError?: (error: ParseError) => void;
	/**
	 * The most characters it holds at once: the line it has not seen the end of, and the data of the
	 * event it has not finished. Past it, it reports `max-buffer-size-exceeded` and takes no more.
	 */
	maxBufferSize?: number;
}

/** A parser of the `text/event-stream` format, fed text as it arrives. */
export interface EventSourceParser {
	feed(chunk: string): void;
	reset(options?: { consume?: boolean }): void;
}

/** Makes a parser that calls `config`'s callbacks as it reads. */
export function createParser(config: ParserConfig): EventSourceParser;
