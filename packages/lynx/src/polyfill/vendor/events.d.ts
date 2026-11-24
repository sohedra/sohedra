// The types of events.js, which scripts/polyfill/bundle.ts writes from event-target-shim.

/** DOM's `Event`. */
export const Event: typeof globalThis.Event;

/** DOM's `EventTarget`. */
export const EventTarget: typeof globalThis.EventTarget;

/** Where what an event listener throws goes, in place of the console. */
export function setErrorHandler(handler: ((error: Error) => void) | undefined): void;

/** A warning of the package: its code (`W06`), its text and what it is about. */
export interface Warning {
	code: string;
	message: string;
	args: unknown[];
}

/** Where the package's warnings go, in place of the console. */
export function setWarningHandler(handler: ((warning: Warning) => void) | undefined): void;
