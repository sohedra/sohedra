// A thread flag (`background`, `mainThread`, `BROWSER`) read where it reaches the markup, outside
// an `{#if}` test, is a build warning in development and production alike: the threads draw
// different content at one place with no block between them, so hydration pairs the first frame's
// elements with the background's by place, and an early tap can run the other content's handler.
// An `{#if}` test is safe whatever its form: hydration pairs by the branch each block took.
//
// Safe too: an event attribute's value (`ontap`, `main-thread:ontap`, a component's `on…` prop),
// an attachment, and the callbacks of `$effect`, `$effect.pre` and `onMount`, which run on the
// background alone. The script's top-level names that depend on a flag are followed: a
// declaration whose value reads one, a function whose body does, and what a statement that reads
// one assigns, changes through a method, or assigns in a function of the script it calls. The pass
// reads names, not scopes, as thread-branches.ts does, and follows nothing into other modules.

import { attributeName, field, identifierName, scriptProgram } from "../../svelte/build/index.ts";
import type { AnyNode } from "../../svelte/build/index.ts";
import { MAIN_THREAD_PREFIX } from "../../wire/index.ts";
import { DECLARING, MARKUP } from "../checks/component-roots.ts";
import { FUNCTIONS, SKIPPED_KEYS } from "../checks/script-names.ts";
import { silencer } from "../checks/silencing.ts";
import { flagNames, flagOf } from "../checks/thread-flags.ts";
import type { FlagNames } from "../checks/thread-flags.ts";
import { buildWarning, placeAt } from "../diagnostics/messages.ts";
import { patternNames } from "../main-thread-functions/directive.ts";
import type { Pass } from "./pass.ts";

const CODE = "thread_flag_outside_if";

/** The calls whose callback runs on the background alone. */
const BACKGROUND_CALLBACKS = new Set(["$effect", "$effect.pre", "onMount"]);

/** Nodes whose `key`, unless computed, is a name rather than a read. */
const KEYED = new Set(["Property", "PropertyDefinition", "MethodDefinition"]);

/** A read that reaches the markup: where, the name read as written, and the flag behind it. */
interface Read {
	start: number;
	read: string;
	flag: string;
}

/** The script's names that depend on a flag, with the flag as written. */
type Dependents = Map<string, string>;

/** A call's callee as written, when it is a name or a name's member: `onMount`, `$effect.pre`. */
function calleeName(call: AnyNode): string | undefined {
	const callee = field(call, "callee");
	const name = identifierName(callee);
	if (name !== undefined || callee?.type !== "MemberExpression" || callee.computed) return name;
	const object = identifierName(field(callee, "object"));
	const property = identifierName(field(callee, "property"));
	return object === undefined || property === undefined ? undefined : `${object}.${property}`;
}

/** Whether a node is a call whose callback runs on the background alone. */
const backgroundCallback = (node: AnyNode): boolean =>
	node.type === "CallExpression" && BACKGROUND_CALLBACKS.has(calleeName(node) ?? "");

/** The default values of a binding pattern: the only reads in it. */
function* defaults(pattern: unknown): Generator<AnyNode> {
	if (!pattern || typeof pattern !== "object") return;
	// Boundary: a pattern's nodes are read by shape.
	const node = pattern as AnyNode;
	if (node.type === "AssignmentPattern") yield field(node, "right")!;
	for (const [key, value] of Object.entries(node))
		if (!SKIPPED_KEYS.has(key))
			for (const child of Array.isArray(value) ? value : [value]) yield* defaults(child);
}

/** The child nodes of a JavaScript node that may read a name: no keys, labels, or bound names. */
function* children(node: AnyNode): Generator<AnyNode> {
	for (const [key, value] of Object.entries(node)) {
		if (SKIPPED_KEYS.has(key) || key === "label") continue;
		if (key === "property" && node.type === "MemberExpression" && !node.computed) continue;
		if (key === "key" && KEYED.has(node.type as string) && !node.computed) continue;
		if (key === "params" && FUNCTIONS.has(node.type as string)) continue;
		if (key === "id") {
			if (node.type === "VariableDeclarator") yield* defaults(value);
			continue;
		}
		for (const child of Array.isArray(value) ? value : [value])
			// Boundary: the AST's nodes are read by shape.
			if (child && typeof child === "object" && typeof child.type === "string")
				yield child as AnyNode;
	}
}

/** What the script and the markup read by: the flags, the names that depend on one, the source. */
interface Names {
	flags: FlagNames;
	dependents: Dependents;
	source: string;
}

/** The first read of a flag, or of a name that depends on one, in a node, outside a callback. */
function firstRead(node: AnyNode, names: Names): Read | undefined {
	if (backgroundCallback(node)) return undefined;
	if (flagOf(node, names.flags) !== undefined) {
		const written = names.source.slice(node.start, node.end);
		return { start: node.start!, read: written, flag: written };
	}
	const name = identifierName(node);
	if (name !== undefined) {
		const flag = names.dependents.get(name);
		return flag === undefined ? undefined : { start: node.start!, read: name, flag };
	}
	for (const child of children(node)) {
		const found = firstRead(child, names);
		if (found !== undefined) return found;
	}
	return undefined;
}

/** The name a member chain starts from: `items` of `items.list.push`. */
function rootName(node: AnyNode | undefined): string | undefined {
	while (node?.type === "MemberExpression") node = field(node, "object");
	return identifierName(node);
}

/**
 * The names a statement assigns, changes through a method, or assigns in a function of the script
 * it calls, outside a callback that runs on the background alone.
 */
function assigned(
	node: AnyNode,
	functions: ReadonlyMap<string, AnyNode>,
	found: Set<string> = new Set(),
	called: Set<string> = new Set(),
): Set<string> {
	if (backgroundCallback(node)) return found;
	if (node.type === "AssignmentExpression") {
		const left = field(node, "left");
		const root = rootName(left);
		if (root !== undefined) found.add(root);
		else for (const name of patternNames(left)) found.add(name);
	}
	if (node.type === "UpdateExpression") {
		const root = rootName(field(node, "argument"));
		if (root !== undefined) found.add(root);
	}
	if (node.type === "CallExpression") {
		const callee = field(node, "callee")!;
		const name = identifierName(callee);
		const body = name === undefined ? undefined : functions.get(name);
		if (callee.type === "MemberExpression") {
			const root = rootName(callee);
			if (root !== undefined) found.add(root);
		} else if (body !== undefined && !called.has(name!)) {
			called.add(name!);
			assigned(body, functions, found, called);
		}
	}
	for (const child of children(node)) assigned(child, functions, found, called);
	return found;
}

/** The top-level statements of the component's scripts, an export's declaration in its place. */
function statementsOf(ast: Parameters<Pass>[0]["ast"]): AnyNode[] {
	return [scriptProgram(ast.module), scriptProgram(ast.instance)].flatMap((program) =>
		// Boundary: the program's statements are read by shape.
		((program?.body ?? []) as AnyNode[]).map(
			(statement) => field(statement, "declaration") ?? statement,
		),
	);
}

/** The script's names that depend on a flag, followed until no more are found. */
function dependentsOf(statements: readonly AnyNode[], names: Names): void {
	const functions = new Map<string, AnyNode>();
	for (const statement of statements) {
		if (statement.type === "FunctionDeclaration") {
			const name = identifierName(field(statement, "id"));
			if (name !== undefined) functions.set(name, field(statement, "body")!);
		}
		if (statement.type !== "VariableDeclaration") continue;
		for (const declarator of statement.declarations as AnyNode[]) {
			const name = identifierName(field(declarator, "id"));
			const init = field(declarator, "init");
			if (name !== undefined && FUNCTIONS.has(init?.type as string)) functions.set(name, init!);
		}
	}
	const add = (name: string, flag: string): void => {
		if (!names.dependents.has(name) && !names.flags.flags.has(name))
			names.dependents.set(name, flag);
	};
	let size = -1;
	while (names.dependents.size !== size) {
		size = names.dependents.size;
		for (const statement of statements) {
			if (statement.type === "ImportDeclaration") continue;
			if (statement.type === "FunctionDeclaration") {
				const name = identifierName(field(statement, "id"));
				const read = firstRead(field(statement, "body")!, names);
				if (name !== undefined && read !== undefined) add(name, read.flag);
				continue;
			}
			if (statement.type === "VariableDeclaration") {
				for (const declarator of statement.declarations as AnyNode[]) {
					const read = firstRead(declarator, names);
					if (read !== undefined)
						for (const name of patternNames(field(declarator, "id"))) add(name, read.flag);
				}
				continue;
			}
			const read = firstRead(statement, names);
			if (read !== undefined)
				for (const name of assigned(statement, functions)) add(name, read.flag);
		}
	}
}

/** Whether an attribute is an event's: `ontap`, `main-thread:ontap`, a component's `onselect`. */
const isEvent = (attribute: AnyNode): boolean =>
	attribute.type === "Attribute" &&
	attributeName(attribute).replace(MAIN_THREAD_PREFIX, "").startsWith("on");

/** Every expression of the markup outside an `{#if}` test, an event attribute and an attachment. */
function markupExpressions(node: unknown, found: AnyNode[]): AnyNode[] {
	if (!node || typeof node !== "object") return found;
	if (Array.isArray(node)) {
		for (const item of node) markupExpressions(item, found);
		return found;
	}
	// Boundary: the markup's nodes are read by shape.
	const record = node as AnyNode;
	if (typeof record.type === "string" && !MARKUP.has(record.type)) {
		found.push(record);
		return found;
	}
	if (record.type === "AttachTag" || isEvent(record)) return found;
	for (const [key, value] of Object.entries(record)) {
		if (key === "parent" || key === "metadata") continue;
		if (record.type === "IfBlock" && key === "test") continue;
		if (record.type === "SnippetBlock" && key === "expression") continue;
		if (DECLARING.has(key) && record.type !== "Attribute" && record.type !== "StyleDirective")
			continue;
		markupExpressions(value, found);
	}
	return found;
}

/** Warns where the markup reads a thread flag, or a name that depends on one, outside an `{#if}` test. */
export const threadFlagReads: Pass = ({ ast, source, filename, thread, warnings }) => {
	// The background's copy alone, so each place is reported once.
	if (thread !== "background") return [];
	const flags = flagNames([scriptProgram(ast.module), scriptProgram(ast.instance)]);
	if (flags.flags.size === 0 && flags.namespaces.size === 0) return [];
	const names: Names = { flags, dependents: new Map(), source };
	dependentsOf(statementsOf(ast), names);
	const silenced = silencer(source);
	const warned = new Set<number>();
	for (const expression of markupExpressions(ast.fragment, [])) {
		const read = firstRead(expression, names);
		if (read === undefined || warned.has(read.start) || silenced(CODE, read.start)) continue;
		warned.add(read.start);
		warnings.push(
			buildWarning({
				code: CODE,
				details: { read: read.read, flag: read.flag },
				place: placeAt({ file: filename, text: source }, read.start),
			}),
		);
	}
	return [];
};
