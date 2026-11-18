// Main-thread refs on the main thread: one `{ current }` for each id, which every function and
// element that names the id shares. A ref is made from its handle's initial value the first time
// the main thread sees the id, and forgotten when the background lets go of its handle (`unref`)
// or the page starts over.

import { REF_FIELDS } from "../../wire/index.ts";
import type { MainThreadRefHandle } from "../../wire/index.ts";

/** A main-thread ref, as main-thread functions hold it. */
export class Ref {
	current: unknown;
	/** The ref's id: `REF_FIELDS.id`, written out for its declaration. */
	declare readonly _wvid: number;

	constructor(id: number, current: unknown) {
		this.current = current;
		Object.defineProperty(this, REF_FIELDS.id, { value: id });
	}

	/** The ref as it crosses: its handle, without its value, which stays here. */
	toJSON(): MainThreadRefHandle {
		return { [REF_FIELDS.id]: this[REF_FIELDS.id] };
	}
}

/** The refs of one page. */
export interface Refs {
	/** The ref a handle names, made from its initial value the first time. */
	of(handle: MainThreadRefHandle): Ref;
	/** The ref `id` is, if the main thread has seen it. */
	find(id: number): Ref | undefined;
	/** From now on, `to` names the ref `from` names, unless `to` names one already. */
	alias(to: number, from: number): void;
	/** The background let go of these refs. */
	drop(ids: readonly number[]): void;
	readonly size: number;
}

/** The refs of one page. */
export function createRefs(): Refs {
	const refs = new Map<number, Ref>();
	return {
		of(handle) {
			const id = handle[REF_FIELDS.id];
			let ref = refs.get(id);
			if (!ref) refs.set(id, (ref = new Ref(id, handle[REF_FIELDS.initial])));
			return ref;
		},
		find: (id) => refs.get(id),
		alias(to, from) {
			const ref = refs.get(from);
			if (ref && !refs.has(to)) refs.set(to, ref);
		},
		drop(ids) {
			for (const id of ids) refs.delete(id);
		},
		get size() {
			return refs.size;
		},
	};
}
