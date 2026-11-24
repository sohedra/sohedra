// The flags that tell the threads apart, as a script names them: `background` and `mainThread`
// from `@sohedra/lynx/env`, and `BROWSER` from `esm-env` (the background on Lynx), each imported
// under any name or read from a namespace import. The thread branches of a component's markup and
// the checks of the app's code read them the same way.

import { field, identifierName } from "../../svelte/build/index.ts";
import type { AnyNode, ScriptProgram } from "../../svelte/build/index.ts";
import { PACKAGE_NAME } from "../../wire/index.ts";
import type { Thread } from "../../wire/index.ts";

/** The flags each module exports, by name, with the thread whose bundle each is `true` in. */
const FLAG_MODULES: Readonly<Record<string, Readonly<Record<string, Thread>>>> = {
	[`${PACKAGE_NAME}/env`]: { background: "background", mainThread: "main-thread" },
	"esm-env": { BROWSER: "background" },
};

/** How a script names the flags it imports. */
export interface FlagNames {
	/** By local name. */
	flags: Map<string, Thread>;
	/** Namespace imports of a module of flags, with that module's flags. */
	namespaces: Map<string, Readonly<Record<string, Thread>>>;
}

/** The flags the programs import (a component's module script and instance script, or a module). */
export function flagNames(programs: readonly (ScriptProgram | AnyNode | undefined)[]): FlagNames {
	const names: FlagNames = { flags: new Map(), namespaces: new Map() };
	for (const program of programs) {
		// Boundary: the program's statements are read by shape.
		for (const node of (program?.body ?? []) as AnyNode[]) {
			if (node.type !== "ImportDeclaration") continue;
			const exported = FLAG_MODULES[String(field(node, "source")?.value)];
			if (exported === undefined) continue;
			for (const specifier of node.specifiers as AnyNode[]) {
				const local = identifierName(field(specifier, "local"));
				if (local === undefined) continue;
				if (specifier.type === "ImportNamespaceSpecifier") names.namespaces.set(local, exported);
				const imported = identifierName(field(specifier, "imported"));
				const thread = imported === undefined ? undefined : exported[imported];
				if (specifier.type === "ImportSpecifier" && thread !== undefined)
					names.flags.set(local, thread);
			}
		}
	}
	return names;
}

/** The thread a node names as a flag, if it is one. */
export function flagOf(node: AnyNode, names: FlagNames): Thread | undefined {
	const name = identifierName(node);
	if (name !== undefined) return names.flags.get(name);
	if (node.type !== "MemberExpression" || node.computed) return undefined;
	const object = identifierName(field(node, "object"));
	const property = identifierName(field(node, "property"));
	const exported = object === undefined ? undefined : names.namespaces.get(object);
	return property === undefined ? undefined : exported?.[property];
}
