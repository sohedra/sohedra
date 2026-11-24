// Which names of a script are the binding's `runOnBackground` and `runOnMainThread`, which a
// main-thread function calls on the thread it runs on: never captured, and the function handed to
// `runOnBackground` is the background's. Known by their import, as the thread flags are
// (checks/thread-flags.ts): imported from `@sohedra/lynx` under any name, or read from a namespace
// import of it. An import of the same name from another module (an app's own module that re-exports
// it) counts too, as it always has. A name declared inside the script, or one the script cannot
// tell (another name for an import from another module, a default import, a namespace of another
// module), is not the binding's: the compile of main-thread functions refuses the second kind where
// a main-thread function reads it. The compile (find.ts) and the checks of the app's code
// (checks/script-uses.ts) read a script's names here, so they agree.

import { PACKAGE_NAME } from "../../wire/index.ts";
import { unwrap } from "./directive.ts";
import type { Node } from "./node.ts";

/** A function of the binding that a main-thread function calls on its own thread. */
export type ThreadFunction = "runOnBackground" | "runOnMainThread";

const THREAD_FUNCTIONS: ReadonlySet<string> = new Set<ThreadFunction>([
	"runOnBackground",
	"runOnMainThread",
]);

/**
 * The binding's functions a main-thread function calls through an import marked
 * `with { runtime: "shared" }`, which gives the main thread its own copy.
 */
const SHARED_FUNCTIONS: ReadonlySet<string> = new Set(["reportError"]);

const isThreadFunction = (name: string): name is ThreadFunction => THREAD_FUNCTIONS.has(name);

/** How a script names the binding's thread functions, and what it imports of the binding. */
export interface ThreadFunctionNames {
	/** The local names of the thread functions, each with the function it is. */
	functions: Map<string, ThreadFunction>;
	/** The local names of namespace imports of `@sohedra/lynx`. */
	namespaces: Set<string>;
	/** Local names the script cannot tell are the binding's thread functions, with the one each may be. */
	unclear: Map<string, ThreadFunction>;
	/** The local names of namespace imports of other modules. */
	otherNamespaces: Set<string>;
	/** The local names of the script's imports of `@sohedra/lynx`, each with its exported name. */
	binding: Map<string, string>;
}

/** The names the programs import (a component's module script and instance script, or a module). */
export function threadFunctionNames(programs: readonly Node[]): ThreadFunctionNames {
	const names: ThreadFunctionNames = {
		functions: new Map(),
		namespaces: new Set(),
		unclear: new Map(),
		otherNamespaces: new Set(),
		binding: new Map(),
	};
	for (const program of programs) {
		for (const node of program?.body ?? []) {
			if (node.type !== "ImportDeclaration" || node.importKind === "type") continue;
			const ours = node.source?.value === PACKAGE_NAME;
			for (const specifier of node.specifiers) {
				if (specifier.importKind === "type") continue;
				const local: string = specifier.local.name;
				if (specifier.type === "ImportNamespaceSpecifier") {
					(ours ? names.namespaces : names.otherNamespaces).add(local);
					continue;
				}
				if (specifier.type !== "ImportSpecifier") {
					// A default import: the binding has none, and another module's may be anything.
					if (isThreadFunction(local)) names.unclear.set(local, local);
					continue;
				}
				const imported: string = specifier.imported.name ?? specifier.imported.value;
				if (ours) names.binding.set(local, imported);
				if (ours && isThreadFunction(imported)) names.functions.set(local, imported);
				else if (!ours && isThreadFunction(imported) && imported === local)
					names.functions.set(local, imported);
				else if (!ours && isThreadFunction(imported)) names.unclear.set(local, imported);
				else if (!ours && isThreadFunction(local)) names.unclear.set(local, local);
			}
		}
	}
	return names;
}

/**
 * The binding's thread function `callee` names: an imported name, or a member of a namespace import
 * of the binding. `atTop` says whether a name is declared at the script's top level, where its
 * imports are, and not by a scope inside that shadows it.
 */
export function threadFunctionOf(
	callee: Node,
	names: ThreadFunctionNames,
	atTop: (name: string) => boolean,
): ThreadFunction | undefined {
	const node = unwrap(callee);
	if (node?.type === "Identifier")
		return atTop(node.name) ? names.functions.get(node.name) : undefined;
	const member = namespaceMember(node);
	if (member === undefined || !names.namespaces.has(member.namespace) || !atTop(member.namespace))
		return undefined;
	return isThreadFunction(member.name) ? member.name : undefined;
}

/**
 * What `node` reads that the script cannot tell is one of the binding's thread functions, as
 * written, with the function it may be; `undefined` when it reads no such name.
 */
export function unclearThreadFunction(
	node: Node,
	names: ThreadFunctionNames,
	atTop: (name: string) => boolean,
): { written: string; name: ThreadFunction } | undefined {
	const read = unwrap(node);
	if (read?.type === "Identifier") {
		const name = names.unclear.get(read.name);
		return name !== undefined && atTop(read.name) ? { written: read.name, name } : undefined;
	}
	const member = namespaceMember(read);
	if (
		member === undefined ||
		!isThreadFunction(member.name) ||
		!names.otherNamespaces.has(member.namespace) ||
		!atTop(member.namespace)
	)
		return undefined;
	return { written: `${member.namespace}.${member.name}`, name: member.name };
}

/**
 * Whether the local name `name`, declared at the script's top level, is a function of the binding
 * that a main-thread function calls through a shared import (`with { runtime: "shared" }`).
 */
export function needsSharedImport(name: string, names: ThreadFunctionNames): boolean {
	const imported = names.binding.get(name);
	return imported !== undefined && SHARED_FUNCTIONS.has(imported);
}

/** A member read from a name, `namespace.name`, not computed. */
function namespaceMember(node: Node): { namespace: string; name: string } | undefined {
	if (node?.type !== "MemberExpression" || node.computed || node.optional) return undefined;
	const object = unwrap(node.object);
	if (object?.type !== "Identifier" || node.property?.type !== "Identifier") return undefined;
	return { namespace: object.name, name: node.property.name };
}
