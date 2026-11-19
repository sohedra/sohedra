// Where the object of a main-thread function declaration is made. A function declaration exists
// before the first statement of its scope runs, so code above it may use it. Its object is made at
// the top of the scope instead of where it was written, when every name it captures, and every name
// its object reads for a `runOnBackground` handle, is set there too: a parameter, an import, a
// function, a name of a scope around it, or a main-thread function declaration made before it.
// Otherwise the object stays where it was written, and a use above it is an error that says so.

import type { Fail, Found, Scope } from "./find.ts";
import type { Node } from "./node.ts";

/** The main-thread function declarations made at the top of their scope. */
export interface Hoisting {
	/** Each declaration's place, by its node. */
	at: Map<Node, number>;
	/** The declarations in the order to make them: one that another captures first. */
	order: Node[];
}

/** Keys of a node that hold no expression read where it stands. */
const NOT_READ = new Set([
	"type",
	"start",
	"end",
	"loc",
	"range",
	"leadingComments",
	"trailingComments",
]);

/**
 * The names an expression reads as it is evaluated: those in a function inside it are read only
 * when it runs, and a member's or a property's key that is not computed is no name.
 */
export function readAtOnce(node: Node): string[] {
	const names: string[] = [];
	const visit = (value: unknown, key?: string): void => {
		if (Array.isArray(value)) {
			for (const item of value) visit(item);
			return;
		}
		if (typeof value !== "object" || value === null) return;
		const child: Node = value;
		if (typeof child.type !== "string") return;
		if (child.type === "Identifier") {
			if (key !== "property" && key !== "key") names.push(child.name);
			return;
		}
		if (/Function|ArrowFunction/.test(child.type)) return;
		for (const [field, item] of Object.entries(child)) {
			if (NOT_READ.has(field)) continue;
			visit(item, child.computed === true ? undefined : field);
		}
	};
	visit(node);
	return names;
}

/**
 * Decide where each main-thread function declaration of `found` is made, and fail for one that
 * stays below a use of it (`earlyUses`).
 */
export function hoistDeclarations(options: {
	found: Found[];
	earlyUses: Map<Node, Node>;
	fail: Fail;
}): Hoisting {
	const { found, earlyUses, fail } = options;
	const byNode = new Map(found.map((fn) => [fn.node, fn]));
	const hoisting: Hoisting = { at: new Map(), order: [] };
	const decided = new Map<Found, boolean | "deciding">();
	/** The captured names that keep each declaration where it was written. */
	const blocked = new Map<Found, string[]>();

	const hoistable = (fn: Found, scope: Scope): boolean => {
		const known = decided.get(fn);
		// Two declarations that capture each other: neither can be made first.
		if (known === "deciding") return false;
		if (known !== undefined) return known;
		decided.set(fn, "deciding");
		const blocking: string[] = [];
		const setAtTop = (name: string): boolean => {
			const other = byNode.get(scope.declarations.get(name));
			return other !== undefined ? hoistable(other, scope) : scope.early.has(name);
		};
		for (const [name, from] of fn.capturedFrom)
			if (from === scope && !setAtTop(name)) blocking.push(name);
		// The object holds a handle to each background function, made from what the argument reads.
		for (const handle of fn.handles)
			for (const name of readAtOnce(handle))
				if (scope.names.has(name) && !setAtTop(name) && !blocking.includes(name))
					blocking.push(name);
		const result = scope.top !== undefined && blocking.length === 0;
		decided.set(fn, result);
		if (result) {
			hoisting.at.set(fn.node, scope.top!);
			hoisting.order.push(fn.node);
		} else {
			blocked.set(fn, blocking);
		}
		return result;
	};

	for (const fn of found) {
		// An unnamed `export default function` is used by no one in its file.
		if (fn.declaredIn === undefined || !fn.node.id || hoistable(fn, fn.declaredIn)) continue;
		const use = earlyUses.get(fn.node);
		if (use !== undefined)
			fail(use, {
				code: "main_thread_function_used_early",
				details: { name: fn.node.id.name, captures: blocked.get(fn) ?? [] },
			});
	}
	return hoisting;
}
