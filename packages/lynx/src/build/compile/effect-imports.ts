// For the first frame only: keep what the main thread's copy imports where Svelte's server compiler
// drops the code: an `$effect`'s whole body, a `use:` action and an `{@attach}`.
//
// - An `import()` in an effect: a component imported only there would not be in the main thread's
//   build, so its lazy bundle would be split off with the background's code alone and have no
//   main-thread section, and its main-thread functions would be missing. (An `import()` in a
//   handler or a function stays in the server output, unused, which is enough for the build to see
//   it.) Only an `import()` of a string: the build cannot follow another kind.
// - An imported name read only there: the import stays as written, but a package that says it has
//   no side effects is left out of a production build when nothing reads its exports, and with it
//   the main-thread functions it registers as it loads.
//
// Both are written again in a function nothing calls, at the end of the script.

import { field, identifierName, nodes, scriptProgram } from "../../svelte/build/index.ts";
import type { AnyNode, ScriptProgram } from "../../svelte/build/index.ts";
import { stringLiteral } from "../string-literal.ts";
import type { Pass } from "./pass.ts";

const EFFECTS = new Set(["$effect", "$effect.pre", "$effect.root"]);
const KEEPER = "__svelteLynxEffectImports";

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

/** The names the component's scripts import as values: not `import type`, nor `{ type X }`. */
function importedValues(programs: (ScriptProgram | undefined)[]): Set<string> {
	const names = new Set<string>();
	for (const program of programs) {
		// Boundary: the program's statements are read by shape.
		for (const statement of (program?.body ?? []) as AnyNode[]) {
			if (statement.type !== "ImportDeclaration" || statement.importKind === "type") continue;
			// Boundary: the node is read by shape; a declaration's specifiers are nodes.
			for (const specifier of (statement.specifiers ?? []) as AnyNode[]) {
				const name = identifierName(field(specifier, "local"));
				if (name !== undefined && specifier.importKind !== "type") names.add(name);
			}
		}
	}
	return names;
}

/** Where the server copy drops code in the markup: each `use:` action and `{@attach}`. */
function droppedFromMarkup(
	fragment: unknown,
): { at: number | undefined; names: string[]; code: unknown }[] {
	const dropped = [];
	for (const node of nodes(fragment)) {
		if (node.type === "UseDirective") {
			// Boundary: the node is read by shape; an action's name is its dotted path.
			const [name = ""] = String(node.name).split(".");
			dropped.push({ at: node.start, names: [name], code: field(node, "expression") });
		} else if (node.type === "AttachTag") {
			dropped.push({ at: node.start, names: [], code: field(node, "expression") });
		}
	}
	return dropped;
}

/**
 * The first frame's copy of the component with what the server compiler drops kept in a function
 * that never runs: the effects' `import()` calls, and the imported names read only where it drops
 * code.
 *
 * @workaround effect-imports-kept-for-first-frame kind=svelte-internal delete-when="Svelte's server compiler keeps the body of an $effect, an action and an attachment, or the build follows imports another way"
 */
export const effectImports: Pass = ({ ast, thread }) => {
	const program = scriptProgram(ast.instance);
	// The function goes in the component's script: one without has nothing to keep it in.
	if (thread !== "main-thread" || !program) return [];
	const imported = importedValues([program, scriptProgram(ast.module)]);
	const specifiers = new Set<string>();
	const names = new Set<string>();
	const read = (code: unknown): void => {
		for (const inner of nodes(code)) {
			const name = identifierName(inner);
			if (name !== undefined && imported.has(name)) names.add(name);
			const target = inner.type === "ImportExpression" ? field(inner, "source") : undefined;
			if (target?.type === "Literal" && typeof target.value === "string")
				specifiers.add(stringLiteral(target.value));
		}
	};
	let first: number | undefined;
	for (const node of nodes(program)) {
		if (!isEffectCall(node)) continue;
		first ??= node.start;
		read(field(node, "arguments"));
	}
	for (const dropped of droppedFromMarkup(ast.fragment)) {
		first ??= dropped.at;
		for (const name of dropped.names) if (imported.has(name)) names.add(name);
		read(dropped.code);
	}
	if (specifiers.size === 0 && names.size === 0) return [];
	const body = [
		...[...specifiers].map((specifier) => `import(${specifier});`),
		...[...names].map((name) => `${name};`),
	].join(" ");
	const end = program.end;
	// The function is at the end of the script, and its map points at the first code it came from.
	return [
		{
			start: end,
			end,
			pieces: [{ text: `\nfunction ${KEEPER}() { ${body} }\n`, at: first ?? end }],
		},
	];
};
