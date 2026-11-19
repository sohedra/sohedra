// For the first frame only: keep what the main thread's copy imports, where Svelte's server compiler
// drops code (an `$effect`'s whole body, a `use:` action, an `{@attach}`, a `<svelte:boundary>`'s
// children while it is pending, and wherever else it may).
//
// - An `import()` in an effect: a component imported only there would not be in the main thread's
//   build, so its lazy bundle would be split off with the background's code alone and have no
//   main-thread section, and its main-thread functions would be missing. (An `import()` in a
//   handler or a function stays in the server output, unused, which is enough for the build to see
//   it.) Only an `import()` of a string: the build cannot follow another kind.
// - Every name the component imports and reads as a value: the import stays as written, but a
//   package that says it has no side effects is left out of a production build when nothing reads
//   its exports, and with it the main-thread functions it registers as it loads. A name read only
//   as a type is left out (value-reads.ts).
//
// Both are written again in a block that never runs, at the end of the script: a statement, which
// the bundler counts, where a function nothing calls would not be, at a module script's top level.

import { field, identifierName, nodes, scriptProgram } from "../../svelte/build/index.ts";
import type { AnyNode } from "../../svelte/build/index.ts";
import { stringLiteral } from "../string-literal.ts";
import type { Pass } from "./pass.ts";
import { importedValueReads } from "./value-reads.ts";

const EFFECTS = new Set(["$effect", "$effect.pre", "$effect.root"]);
/** A global no one sets: the block it guards never runs, and reads no import as the page loads. */
const KEEPER = "__svelteLynxKeptImports";

/** `$effect`, `$effect.pre` or `$effect.root`, as the callee of a call. */
function isEffectCall(node: AnyNode): boolean {
	if (node.type !== "CallExpression") return false;
	const callee = field(node, "callee");
	if (callee === undefined) return false;
	const name = identifierName(callee);
	if (name !== undefined) return EFFECTS.has(name);
	if (callee.type !== "MemberExpression" || callee.computed) return false;
	const object = identifierName(field(callee, "object"));
	const property = identifierName(field(callee, "property"));
	return object !== undefined && property !== undefined && EFFECTS.has(`${object}.${property}`);
}

/**
 * The first frame's copy of the component with what the server compiler may drop kept in a block
 * that never runs: the effects' `import()` calls, and every imported name read as a value.
 *
 * @workaround effect-imports-kept-for-first-frame kind=svelte-internal delete-when="Svelte's server compiler keeps the code it does not run (an $effect's body, an action, an attachment, a pending boundary's children), or the build follows imports another way"
 */
export const effectImports: Pass = ({ ast, thread }) => {
	const instance = scriptProgram(ast.instance);
	const module = scriptProgram(ast.module);
	// The block goes at the end of a script: a component without one has nothing to keep.
	const program = instance ?? module;
	if (thread !== "main-thread" || !program) return [];
	const programs = [instance, module].filter((found) => found !== undefined) as AnyNode[];
	const names = importedValueReads(programs, [...programs, ast.fragment]);
	const specifiers = new Set<string>();
	let first: number | undefined;
	for (const node of instance ? nodes(instance) : []) {
		if (!isEffectCall(node)) continue;
		first ??= node.start;
		for (const inner of nodes(field(node, "arguments"))) {
			const target = inner.type === "ImportExpression" ? field(inner, "source") : undefined;
			if (target?.type === "Literal" && typeof target.value === "string")
				specifiers.add(stringLiteral(target.value));
		}
	}
	if (specifiers.size === 0 && names.length === 0) return [];
	const body = [
		...[...specifiers].map((specifier) => `import(${specifier});`),
		...names.map((name) => `${name};`),
	].join(" ");
	const end = program.end;
	// The block is at the end of the script, and its map points at the first effect it came from.
	return [
		{
			start: end,
			end,
			pieces: [{ text: `\nif (typeof ${KEEPER} !== "undefined") { ${body} }\n`, at: first ?? end }],
		},
	];
};
