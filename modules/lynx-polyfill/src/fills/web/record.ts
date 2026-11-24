// Records: objects with no prototype, which a promise of this folder resolves with. Resolving a
// promise reads its value's `then`, so a page's `Object.prototype.then` would step into a plain
// object's; it can't into a record's.

/** `fields` on an object with no prototype, which a promise can resolve with safely. */
export function record<T extends object>(fields: T): T {
	return Object.setPrototypeOf(fields, null) as T;
}

/** A chunk a body's puller gives, or its end: a record. */
export interface Pulled {
	done: boolean;
	value?: Uint8Array;
}

/** A body's bytes, loaded: a record. */
export interface Loaded {
	bytes: Uint8Array;
}
