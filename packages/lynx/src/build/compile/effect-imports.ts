// For the first frame only: keep an `import()` that sits inside an `$effect`.
//
// Svelte's server compiler drops an `$effect`'s whole body, so a component that is imported only
// there would not be in the main thread's build: its lazy bundle would be split off with the
// background's code alone and have no main-thread section, and its main-thread functions would
// be missing. (An `import()` in a handler or a function stays in the server output, unused,
// which is enough for the build to see it.) The imports found in an effect are written again in
// a function nothing calls, at the end of the script.
//
// Only an `import()` of a string: the build cannot follow another kind.

import { nodes, scriptProgram } from "../../svelte/build/index.ts";
import type { AnyNode } from "../../svelte/build/index.ts";
import type { Pass } from "./pass.ts";

const EFFECTS = new Set(["$effect", "$effect.pre", "$effect.root"]);
const KEEPER = "__svelteLynxEffectImports";

/** `$effect`, `$effect.pre` or `$effect.root`, as the callee of a call. */
function isEffectCall(node: AnyNode): boolean {
	if (node.type !== "CallExpression") return false;
	const callee = node.callee as AnyNode;
	if (callee.type === "Identifier") return EFFECTS.has(callee.name as string);
	if (callee.type !== "MemberExpression" || callee.computed) return false;
	const object = callee.object as AnyNode;
	const property = callee.property as AnyNode;
	return (
		object.type === "Identifier" &&
		property.type === "Identifier" &&
		EFFECTS.has(`${object.name as string}.${property.name as string}`)
	);
}

/**
 * The first frame's copy of the component with the effects' `import()` calls kept in a function
 * that never runs.
 *
 * @workaround effect-imports-kept-for-first-frame kind=svelte-internal delete-when="Svelte's server compiler keeps the body of an $effect, or the build follows imports another way"
 */
export const effectImports: Pass = ({ ast, thread }) => {
	const program = scriptProgram(ast.instance);
	if (thread !== "main-thread" || !program) return [];
	const specifiers = new Set<string>();
	let first: number | undefined;
	for (const node of nodes(program)) {
		if (!isEffectCall(node)) continue;
		first ??= node.start;
		for (const inner of nodes(node.arguments)) {
			const target = inner.type === "ImportExpression" ? (inner.source as AnyNode) : undefined;
			if (target?.type === "Literal" && typeof target.value === "string")
				specifiers.add(JSON.stringify(target.value));
		}
	}
	if (specifiers.size === 0) return [];
	const body = [...specifiers].map((specifier) => `import(${specifier});`).join(" ");
	const end = program.end;
	// The function is at the end of the script, and its map points at the first effect it came from.
	return [
		{
			start: end,
			end,
			pieces: [{ text: `\nfunction ${KEEPER}() { ${body} }\n`, at: first ?? end }],
		},
	];
};
