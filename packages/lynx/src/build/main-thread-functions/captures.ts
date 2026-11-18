// What a main-thread function captures: the names it reads that its file declares outside it,
// narrowed to the members it reads.

import { unwrap } from "./directive.ts";
import type { Node } from "./node.ts";

/** One step of a member path: `settings`, `.size`, `["a-b"]`. */
export interface Segment {
	/** The member's name. */
	name: string;
	/** As a key of an object literal. */
	key: string;
	/** As written after what it is a member of. */
	access: string;
}

/** A captured value, or of an object the members that are captured. */
export type Capture =
	| { key: string; value: string; members?: undefined }
	| { key: string; members: Captures; value?: undefined };

export type Captures = Map<string, Capture>;

/**
 * Add a path to the captures. A value captured whole stays whole, and a later, shorter path
 * takes the place of the members under it. A member is read through `?.`: the body may read it
 * only once it has checked something else, so reading it when the function is made must not
 * throw where the body would not.
 */
export function capture(captures: Captures, path: Segment[]): void {
	const value = path
		.map(({ access }, index) => (index === 0 ? access : `?.${access.replace(/^\./, "")}`))
		.join("");
	let members = captures;
	for (const [index, { name, key }] of path.entries()) {
		if (index === path.length - 1) {
			members.set(name, { key, value });
			return;
		}
		let entry = members.get(name);
		if (!entry) members.set(name, (entry = { key, members: new Map() }));
		if (!entry.members) return;
		members = entry.members;
	}
}

/** How a member is named, if it is by a plain name or a string. */
export function memberSegment(node: Node): Segment | undefined {
	const { property } = node;
	if (!node.computed)
		return property.type === "Identifier"
			? { name: property.name, key: property.name, access: `.${property.name}` }
			: undefined;
	return property.type === "Literal" && typeof property.value === "string"
		? { name: property.value, key: property.raw, access: `[${property.raw}]` }
		: undefined;
}

/** Whether `node` is reached through a `?.`. */
const afterOptional = (node: Node): boolean =>
	(node.type === "MemberExpression" || node.type === "CallExpression") &&
	(node.optional === true ||
		afterOptional(unwrap(node.type === "MemberExpression" ? node.object : node.callee)));

/** Whether a member of `object` can be captured in the object's place. */
export const narrowable = (object: Node): boolean =>
	object.type === "Identifier" || (object.type === "MemberExpression" && !afterOptional(object));

/** Wraps the value of a captured name that the function calls. */
export interface Guard {
	names: Set<string>;
	wrap: (name: string, value: string) => string;
}

/**
 * Wraps the value of a captured `$state` name in the binding's copy, which reads it whole: `value`
 * as the function reads it, `name` as it is written in the source (`cfg.a`).
 */
export interface Copy {
	names: Set<string>;
	wrap: (value: string, name: string) => string;
}

/** How `writeCaptures` writes the values. */
export interface WriteOptions {
	copy?: Copy | undefined;
	guard?: Guard | undefined;
}

/** The captured values as an object literal. */
export function writeCaptures(captures: Captures, options: WriteOptions = {}): string {
	return writeMembers(captures, options, undefined);
}

/** The captured values of `captures`, which are the members of the capture named `root`, if any. */
function writeMembers(captures: Captures, options: WriteOptions, root: string | undefined): string {
	const entries = [...captures].map(([name, entry]) => {
		const { key } = entry;
		if (entry.members) return `${key}: ${writeMembers(entry.members, options, root ?? name)}`;
		const { value } = entry;
		if (options.copy?.names.has(root ?? name))
			return `${key}: ${options.copy.wrap(
				value,
				value.replace(/\?\.(\[?)/g, (_, bracket: string) => bracket || "."),
			)}`;
		if (root === undefined && options.guard?.names.has(name))
			return `${key}: ${options.guard.wrap(name, value)}`;
		return key === value ? key : `${key}: ${value}`;
	});
	return `{ ${entries.join(", ")} }`;
}
