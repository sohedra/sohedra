// The development text that names an op in an error: what the main thread was doing when Lynx
// refused it. The main thread knows the ids; the background, which knows each element's tag, can
// add them.

import { OpCode } from "./ops.ts";
import type { Op } from "./ops.ts";

/** An element's tag by its id, when known. */
export type TagOf = (id: number) => string | null | undefined;

/**
 * What `op` does, as a phrase: `insert <view> 42 into <scroll-view> 7`, or, with no tag known,
 * `insert element 42 into element 7`.
 */
export function describeOp(op: Op, tagOf?: TagOf): string {
	const at = (id: number): string => {
		const tag = tagOf?.(id);
		return tag ? `<${tag}> ${id}` : `element ${id}`;
	};
	switch (op[0]) {
		case OpCode.Create:
			return `create <${op[2]}> ${op[1]}`;
		case OpCode.CreateText:
			return `create the text ${op[1]}`;
		case OpCode.SetText:
			return `set the text of ${at(op[1])}`;
		case OpCode.SetAttr:
			return `set "${op[2]}" on ${at(op[1])}`;
		case OpCode.Insert:
			return `insert ${at(op[2])} into ${at(op[1])}${op[3] === 0 ? "" : ` before ${at(op[3])}`}`;
		case OpCode.Remove:
			return `remove ${at(op[2])} from ${at(op[1])}`;
		case OpCode.SetEvent:
			return `${op[4] === 0 ? "remove" : "set"} the "${op[3]}" event of ${at(op[1])}`;
		case OpCode.Release:
			return `release ${at(op[1])}`;
		case OpCode.ListUpdate:
			return `update the list ${at(op[1])}`;
	}
}
