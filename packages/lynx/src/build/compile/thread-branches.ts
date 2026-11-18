// `$props.id()` agrees on both threads, also after a part of the page only one thread renders.
//
// `{#if background}` keeps its branch off the first frame, and its `{:else}` off the background.
// A component in either calls `$props.id()` on one thread only, and every id after it would differ
// between the first frame and the background. So each such branch that renders a component or a
// snippet is drawn through the runtime's `ThreadBranch`, whose components take ids of the branch's
// own (`lynx-b1`… for the background's branch, `lynx-m1`… for the main thread's): the rest keep the
// same ids on both threads. Both threads' copies wrap the same branches.
//
// The tests recognized, with `background` and `mainThread` imported from `@sohedra/lynx/env` under
// any name, or read from a namespace import of it: `background`, `!background`, `mainThread` and
// `!mainThread`. An `{:else if}` after one is a branch of it, and so is each of its own branches.
// Any other test renders on both threads, or on neither.

import { field, identifierName, nodes, scriptProgram } from "../../svelte/build/index.ts";
import type { AnyNode } from "../../svelte/build/index.ts";
import { PACKAGE_NAME } from "../../wire/index.ts";
import type { Thread } from "../../wire/index.ts";
import type { Edit } from "../source-map/edits.ts";
import { stringLiteral } from "../string-literal.ts";
import type { Pass } from "./pass.ts";

const ENV = `${PACKAGE_NAME}/env`;
/** The runtime's export, and the name a component imports it by. */
const EXPORT = "ThreadBranch";
const LOCAL = "SohedraLynxThreadBranch";
const SNIPPET = "__sohedraLynxBranch";

type Flag = "background" | "mainThread";

/** How a component names the flags of `@sohedra/lynx/env`. */
interface FlagNames {
	/** By local name. */
	flags: Map<string, Flag>;
	/** Namespace imports of the module. */
	namespaces: Set<string>;
}

const isFlag = (name: string | undefined): name is Flag =>
	name === "background" || name === "mainThread";

/** The flags the component imports, from its module script and its instance script. */
function flagNames(ast: Parameters<Pass>[0]["ast"]): FlagNames {
	const names: FlagNames = { flags: new Map(), namespaces: new Set() };
	for (const script of [ast.module, ast.instance]) {
		for (const statement of scriptProgram(script)?.body ?? []) {
			// Boundary: the program's statements are read by shape.
			const node = statement as AnyNode;
			if (node.type !== "ImportDeclaration" || field(node, "source")?.value !== ENV) continue;
			for (const specifier of node.specifiers as AnyNode[]) {
				const local = identifierName(field(specifier, "local"));
				if (local === undefined) continue;
				if (specifier.type === "ImportNamespaceSpecifier") names.namespaces.add(local);
				const imported = identifierName(field(specifier, "imported"));
				if (specifier.type === "ImportSpecifier" && isFlag(imported))
					names.flags.set(local, imported);
			}
		}
	}
	return names;
}

/** The flag a test reads, if it is one. */
function flagOf(test: AnyNode, names: FlagNames): Flag | undefined {
	const name = identifierName(test);
	if (name !== undefined) return names.flags.get(name);
	if (test.type !== "MemberExpression" || test.computed) return undefined;
	const object = identifierName(field(test, "object"));
	const property = identifierName(field(test, "property"));
	return object !== undefined && names.namespaces.has(object) && isFlag(property)
		? property
		: undefined;
}

/** The thread that alone renders the consequent of an `{#if}` with this test, if one does. */
function consequentThread(test: AnyNode | undefined, names: FlagNames): Thread | undefined {
	if (test === undefined) return undefined;
	const negated = test.type === "UnaryExpression" && test.operator === "!";
	const flag = flagOf(negated ? field(test, "argument")! : test, names);
	if (flag === undefined) return undefined;
	return (flag === "background") !== negated ? "background" : "main-thread";
}

/** The other thread. */
const other = (thread: Thread): Thread => (thread === "background" ? "main-thread" : "background");

/** What can call `$props.id()` as it renders: a component, or a snippet that may render one. */
const CALLERS = new Set(["Component", "SvelteComponent", "SvelteSelf", "RenderTag"]);

/** The nodes of a fragment. */
const fragmentNodes = (fragment: AnyNode | undefined): AnyNode[] =>
	(fragment?.nodes ?? []) as AnyNode[];

/** Wraps the branches of `{#if}` blocks that only one thread renders in `ThreadBranch`. */
export const threadBranches: Pass = ({ ast, internals }) => {
	if (internals === undefined) return [];
	const names = flagNames(ast);
	if (names.flags.size === 0 && names.namespaces.size === 0) return [];
	const edits: Edit[] = [];
	const wrapped = new Set<AnyNode>();

	function wrap(fragment: AnyNode | undefined, thread: Thread): void {
		const inside = fragmentNodes(fragment);
		if (fragment === undefined || inside.length === 0 || wrapped.has(fragment)) return;
		if (![...nodes(inside)].some((node) => CALLERS.has(node.type as string))) return;
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
		const thread = consequentThread(field(block, "test"), names);
		if (thread === undefined) continue;
		wrap(field(block, "consequent"), thread);
		wrapChain(field(block, "alternate"), other(thread));
	}
	if (edits.length === 0) return edits;

	const line = `import { ${EXPORT} as ${LOCAL} } from ${stringLiteral(internals)};`;
	const program = scriptProgram(ast.instance);
	edits.push(
		program
			? { start: program.start, end: program.start, text: `\n${line}` }
			: { start: 0, end: 0, text: `<script>${line}</script>\n` },
	);
	return edits;
};
