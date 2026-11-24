// `DOMException`: Web IDL § 2.8.1 "DOMException" and § 3.14.1 its interface object. Both threads
// lack it (PrimJS, lynx-core). Own code, about a kilobyte, where core-js's standalone module is nine
// (the size trim of the polyfill brief). The other fills throw it: `AbortError`, `DataCloneError`,
// `InvalidCharacterError`, `TimeoutError`. Leaves out nothing of the interface; an instance's
// `stack` is the engine's own, as an `Error`'s is.

import type { Scope } from "../globals.ts";
import { installEager } from "../install.ts";

/** @workaround web-dom-exception kind=lynx-gap delete-when="the engine of the oldest Lynx the binding supports has DOMException on both threads" */
export function fillDOMException(scope: Scope): void {
	installEager(scope, "DOMException", DOMException, isFunction);
}

const isFunction = (existing: unknown): boolean => typeof existing === "function";

/**
 * The legacy codes' names, by code from 1 (`INDEX_SIZE_ERR`); and the error names that carry a code,
 * at the same place (`IndexSizeError` is 1), empty where a code has no name.
 */
const LEGACY =
	"INDEX_SIZE DOMSTRING_SIZE HIERARCHY_REQUEST WRONG_DOCUMENT INVALID_CHARACTER NO_DATA_ALLOWED NO_MODIFICATION_ALLOWED NOT_FOUND NOT_SUPPORTED INUSE_ATTRIBUTE INVALID_STATE SYNTAX INVALID_MODIFICATION NAMESPACE INVALID_ACCESS VALIDATION TYPE_MISMATCH SECURITY NETWORK ABORT URL_MISMATCH QUOTA_EXCEEDED TIMEOUT INVALID_NODE_TYPE DATA_CLONE".split(
		" ",
	);
const CODED =
	"IndexSize  HierarchyRequest WrongDocument InvalidCharacter  NoModificationAllowed NotFound NotSupported InUseAttribute InvalidState Syntax InvalidModification Namespace InvalidAccess  TypeMismatch Security Network Abort URLMismatch QuotaExceeded Timeout InvalidNodeType DataClone".split(
		" ",
	);

/** Each exception's name and message, which its prototype's getters read. */
const fields = new WeakMap<object, { name: string; message: string }>();

/** The fields of a `DOMException`, or the `TypeError` a getter on anything else throws. */
function fieldsOf(value: unknown): { name: string; message: string } {
	const found = typeof value === "object" && value !== null ? fields.get(value) : undefined;
	if (!found) throw new TypeError("Illegal invocation: not a DOMException.");
	return found;
}

/** Web IDL's `DOMException`: an `Error` with a `name`, a `message` and the name's legacy `code`. */
export class DOMException extends Error {
	constructor(message?: unknown, name?: unknown) {
		// No message to `Error`, which would make it an own property: Web IDL's are getters.
		super();
		fields.set(this, {
			message: message === undefined ? "" : `${message as string}`,
			name: name === undefined ? "Error" : `${name as string}`,
		});
	}

	override get name(): string {
		return fieldsOf(this).name;
	}

	override get message(): string {
		return fieldsOf(this).message;
	}

	get code(): number {
		const { name } = fieldsOf(this);
		const stem = name.endsWith("Error") ? name.slice(0, -"Error".length) : "";
		return stem === "" ? 0 : CODED.indexOf(stem) + 1;
	}
}

// The legacy codes as constants of the class and of its prototype, as Web IDL's constants are:
// enumerable, neither writable nor configurable.
for (let index = 0; index < LEGACY.length; index++) {
	const constant = { value: index + 1, enumerable: true, writable: false, configurable: false };
	Object.defineProperty(DOMException, `${LEGACY[index]!}_ERR`, constant);
	Object.defineProperty(DOMException.prototype, `${LEGACY[index]!}_ERR`, constant);
}
// Web IDL's attributes are enumerable accessors, and its interfaces name themselves.
for (const key of ["name", "message", "code"])
	Object.defineProperty(DOMException.prototype, key, {
		...Object.getOwnPropertyDescriptor(DOMException.prototype, key),
		enumerable: true,
	});
Object.defineProperty(DOMException.prototype, Symbol.toStringTag, {
	value: "DOMException",
	configurable: true,
});

/**
 * A `DOMException` named `name`, of the thread's own class when it has one (an engine's, or this
 * fill once installed), else of this fill's: so `instanceof DOMException` holds on the thread.
 */
export function domException(scope: Scope, message: string, name: string): Error {
	// Boundary: the standard global, which a thread may lack.
	const Thread = scope["DOMException"] as
		| (new (message: string, name: string) => Error)
		| undefined;
	return new (typeof Thread === "function" ? Thread : DOMException)(message, name);
}
