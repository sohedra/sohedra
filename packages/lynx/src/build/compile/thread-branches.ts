// `$props.id()` agrees on both threads, also after a part of the page only one thread renders.
//
// `{#if background}` keeps its branch off the first frame, and its `{:else}` off the background.
// A component in either calls `$props.id()` on one thread only, and every id after it would differ
// between the first frame and the background. So each such branch that renders a component, a
// snippet or a slot is drawn through the runtime's `ThreadBranch`, whose components take ids of the
// branch's own (`lynx-b1`… for the background's branch, `lynx-m1`… for the main thread's): the rest
// keep the same ids on both threads. Both threads' copies wrap the same branches.
//
// The flags: `background` and `mainThread` from `@sohedra/lynx/env`, and `BROWSER` from `esm-env`,
// which is the background on Lynx and the one flag a shared package can read; each imported under
// any name, or read from a namespace import. The tests recognized:
//   - a flag or its negation (`background`, `!mainThread`, `!BROWSER`): both branches, each its
//     thread's. An `{:else if}` after one is a branch of it, and so is each of its own branches;
//   - a flag joined to more by `&&` (`background && user`): the consequent only. Its `{:else}`
//     renders on one thread always and on the other sometimes, so it is left as it is.
// Any other test that reads a flag, around a branch left as it is that holds a component, gets a
// development warning at its `{#if}`: the ids after it may differ. The pass reads names, not
// scopes: an `{#each}` item named like a flag is taken for the flag, on both threads alike.

import { field, nodes, scriptProgram } from "../../svelte/build/index.ts";
import type { AnyNode } from "../../svelte/build/index.ts";
import type { Thread } from "../../wire/index.ts";
import { flagNames as importedFlags, flagOf } from "../checks/thread-flags.ts";
import type { FlagNames } from "../checks/thread-flags.ts";
import { buildError, buildWarning, placeAt } from "../diagnostics/messages.ts";
import type { Edit } from "../source-map/edits.ts";
import { stringLiteral } from "../string-literal.ts";
import type { Pass } from "./pass.ts";

/** The runtime's export, and the name a component imports it by. */
const EXPORT = "ThreadBranch";
const LOCAL = "SohedraLynxThreadBranch";
const SNIPPET = "__sohedraLynxBranch";
/** The names the pass adds, which a component must not declare itself. */
const OWN_NAMES = new RegExp(`\\b(${LOCAL}|${SNIPPET}\\d*)\\b`);

/** The flags the component imports, from its module script and its instance script. */
const flagNames = (ast: Parameters<Pass>[0]["ast"]): FlagNames =>
	importedFlags([scriptProgram(ast.module), scriptProgram(ast.instance)]);

/** The other thread. */
const other = (thread: Thread): Thread => (thread === "background" ? "main-thread" : "background");

/** The thread a flag or its negation is true on: the one that alone renders the consequent. */
function flagTest(test: AnyNode | undefined, names: FlagNames): Thread | undefined {
	if (test === undefined) return undefined;
	const negated = test.type === "UnaryExpression" && test.operator === "!";
	const thread = flagOf(negated ? field(test, "argument")! : test, names);
	if (thread === undefined) return undefined;
	return negated ? other(thread) : thread;
}

/** The parts of a test joined by `&&`, however nested. */
function conjuncts(test: AnyNode): AnyNode[] {
	if (test.type !== "LogicalExpression" || test.operator !== "&&") return [test];
	return [...conjuncts(field(test, "left")!), ...conjuncts(field(test, "right")!)];
}

/** Whether a test reads a flag anywhere. */
const readsFlag = (test: AnyNode, names: FlagNames): boolean =>
	[...nodes(test)].some((node) => flagOf(node, names) !== undefined);

/** What can call `$props.id()` as it renders: a component, a snippet or a slot that may render one. */
const CALLERS = new Set(["Component", "SvelteComponent", "SvelteSelf", "RenderTag", "SlotElement"]);

/** The nodes of a fragment. */
const fragmentNodes = (fragment: AnyNode | undefined): AnyNode[] =>
	(fragment?.nodes ?? []) as AnyNode[];

/** Whether a fragment holds anything that can call `$props.id()`. */
const holdsCaller = (fragment: AnyNode | undefined): boolean =>
	[...nodes(fragmentNodes(fragment))].some((node) => CALLERS.has(node.type as string));

/** A branch only one thread renders: its `{#if}`, whether it is the `{:else}`, and its thread. */
export interface OneThreadBranch {
	block: AnyNode;
	alternate: boolean;
	thread: Thread;
}

/**
 * The fragments of the `{#if}` branches only one thread renders, as recognized here: a flag's or
 * its negation's two branches, and the consequent of a flag joined to more by `&&`.
 */
export function oneThreadFragments(ast: Parameters<Pass>[0]["ast"]): Map<AnyNode, OneThreadBranch> {
	const fragments = new Map<AnyNode, OneThreadBranch>();
	const names = flagNames(ast);
	if (names.flags.size === 0 && names.namespaces.size === 0) return fragments;
	const add = (block: AnyNode, alternate: boolean, thread: Thread): void => {
		const fragment = field(block, alternate ? "alternate" : "consequent");
		if (fragment !== undefined) fragments.set(fragment, { block, alternate, thread });
	};
	for (const block of nodes(ast.fragment)) {
		if (block.type !== "IfBlock") continue;
		const test = field(block, "test")!;
		const thread = flagTest(test, names);
		if (thread !== undefined) {
			add(block, false, thread);
			add(block, true, other(thread));
			continue;
		}
		const joined = conjuncts(test)
			.map((part) => flagTest(part, names))
			.find((found) => found !== undefined);
		if (joined !== undefined) add(block, false, joined);
	}
	return fragments;
}

/**
 * Wraps the branches of `{#if}` blocks that only one thread renders in `ThreadBranch`, and warns at
 * an `{#if}` that reads a flag around a component in a way it cannot wrap.
 */
export const threadBranches: Pass = (context) => {
	const { ast, internals, source, filename } = context;
	if (internals === undefined) return [];
	const names = flagNames(ast);
	if (names.flags.size === 0 && names.namespaces.size === 0) return [];
	const edits: Edit[] = [];
	const wrapped = new Set<AnyNode>();

	function wrap(fragment: AnyNode | undefined, thread: Thread): void {
		const inside = fragmentNodes(fragment);
		if (fragment === undefined || inside.length === 0 || wrapped.has(fragment)) return;
		if (!holdsCaller(fragment)) return;
		wrapped.add(fragment);
		const name = `${SNIPPET}${wrapped.size - 1}`;
		const start = inside[0]!.start!;
		const end = inside[inside.length - 1]!.end!;
		edits.push(
			{ start, end: start, text: `{#snippet ${name}()}` },
			{ start: end, end, text: `{/snippet}<${LOCAL} thread="${thread}" render={${name}} />` },
		);
	}

	/** A branch that is an `{:else if}` chain: each of its branches is the thread's. */
	function wrapChain(fragment: AnyNode | undefined, thread: Thread): void {
		const inside = fragmentNodes(fragment);
		const elseIf = inside.length === 1 && inside[0]!.elseif === true ? inside[0] : undefined;
		if (elseIf === undefined) {
			wrap(fragment, thread);
			return;
		}
		wrap(field(elseIf, "consequent"), thread);
		wrapChain(field(elseIf, "alternate"), thread);
	}

	for (const block of nodes(ast.fragment)) {
		if (block.type !== "IfBlock") continue;
		const test = field(block, "test")!;
		const consequent = field(block, "consequent");
		const alternate = field(block, "alternate");
		const thread = flagTest(test, names);
		if (thread !== undefined) {
			wrap(consequent, thread);
			wrapChain(alternate, other(thread));
			continue;
		}
		const joined = conjuncts(test)
			.map((part) => flagTest(part, names))
			.find((found) => found !== undefined);
		if (joined !== undefined) wrap(consequent, joined);
		const loose = joined === undefined ? [consequent, alternate] : [alternate];
		if (
			context.development &&
			context.thread === "background" &&
			readsFlag(test, names) &&
			loose.some(holdsCaller)
		)
			context.warnings.push(
				buildWarning({
					code: "thread_branch_test",
					details: { test: source.slice(test.start, test.end) },
					place: placeAt({ file: filename, text: source }, block.start!),
				}),
			);
	}
	if (edits.length === 0) return edits;

	const taken = OWN_NAMES.exec(source);
	if (taken)
		throw buildError({
			code: "thread_branch_name_taken",
			details: { name: taken[1]! },
			place: placeAt({ file: filename, text: source }, taken.index),
		});
	const line = `import { ${EXPORT} as ${LOCAL} } from ${stringLiteral(internals)};`;
	const program = scriptProgram(ast.instance);
	edits.push(
		program
			? { start: program.start, end: program.start, text: `\n${line}` }
			: { start: 0, end: 0, text: `<script>${line}</script>\n` },
	);
	return edits;
};
