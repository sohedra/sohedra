// Svelte's exports that fail on Lynx, reached by the app's code: imported or re-exported by name, or
// read from a namespace import of their module. Svelte's own `mount`, `unmount` and `hydrate` work
// with the web's DOM; the binding's `mount` and `unmount` from `@sohedra/lynx` work on Lynx's page,
// with its renderer, and its `mount` hydrates the first frame itself. `MediaQuery` from
// `svelte/reactivity` calls the web's `matchMedia` as it is made, which neither thread has.

import { field, identifierName, nodes } from "../../svelte/build/index.ts";
import type { AnyNode } from "../../svelte/build/index.ts";

/** The codes a refused export of Svelte's is reported with. */
type RefusedCode = "svelte_mount_imported" | "media_query_imported";

/** Svelte's exports that fail on Lynx, by module, and the code each is reported with. */
const REFUSED: Readonly<Record<string, Readonly<Record<string, RefusedCode>>>> = {
	svelte: {
		mount: "svelte_mount_imported",
		unmount: "svelte_mount_imported",
		hydrate: "svelte_mount_imported",
	},
	"svelte/reactivity": { MediaQuery: "media_query_imported" },
};

/** A use of a refused export: its code and name, where it starts, and its statement's start. */
export interface RefusedSvelteUse {
	code: RefusedCode;
	name: string;
	start: number;
	/** Where the import or export it is part of starts, for a silencing comment above it. */
	anchor: number;
}

/** The code `name` of `module` is refused with, or `undefined` when it works on Lynx. */
function refusedCode(
	module: string | undefined,
	name: string | undefined,
): RefusedCode | undefined {
	if (module === undefined || name === undefined || !Object.hasOwn(REFUSED, module))
		return undefined;
	const names = REFUSED[module]!;
	return Object.hasOwn(names, name) ? names[name] : undefined;
}

/** The module a statement imports or re-exports values from, or `undefined` for any other. */
function valuesFrom(node: AnyNode): string | undefined {
	if (node.type !== "ImportDeclaration" && node.type !== "ExportNamedDeclaration") return undefined;
	if (node.importKind === "type" || node.exportKind === "type") return undefined;
	const source = field(node, "source")?.value;
	return typeof source === "string" ? source : undefined;
}

/** The name a member expression reads, by `.name` or `["name"]`. */
function memberName(node: AnyNode): string | undefined {
	const property = field(node, "property");
	if (!node.computed) return identifierName(property);
	return typeof property?.value === "string" ? property.value : undefined;
}

/**
 * Every use of a refused export of Svelte's in the programs, as written: a named import, a
 * re-export, or a read of a namespace import of its module (`svelte.mount(…)`).
 */
export function refusedSvelteUses(programs: readonly (AnyNode | undefined)[]): RefusedSvelteUse[] {
	const found: RefusedSvelteUse[] = [];
	/** The namespace imports of a module with refused exports: their local name, and the module. */
	const namespaces = new Map<string, string>();
	for (const program of programs) {
		// Boundary: the program's statements are read by shape.
		for (const node of (program?.body ?? []) as AnyNode[]) {
			const module = valuesFrom(node);
			if (module === undefined || !Object.hasOwn(REFUSED, module)) continue;
			const anchor = node.start ?? 0;
			const imports = node.type === "ImportDeclaration";
			for (const specifier of node.specifiers as AnyNode[]) {
				if (specifier.type === "ImportNamespaceSpecifier") {
					const local = identifierName(field(specifier, "local"));
					if (local !== undefined) namespaces.set(local, module);
					continue;
				}
				if (imports && specifier.type !== "ImportSpecifier") continue;
				if (specifier.importKind === "type" || specifier.exportKind === "type") continue;
				const name = identifierName(field(specifier, imports ? "imported" : "local"));
				const code = refusedCode(module, name);
				if (code !== undefined && name !== undefined)
					found.push({ code, name, start: specifier.start ?? anchor, anchor });
			}
		}
	}
	if (namespaces.size === 0) return found;
	for (const program of programs)
		for (const node of nodes(program)) {
			if (node.type !== "MemberExpression") continue;
			const object = identifierName(field(node, "object"));
			const name = memberName(node);
			const code = refusedCode(object === undefined ? undefined : namespaces.get(object), name);
			if (code === undefined || name === undefined) continue;
			const start = node.start ?? 0;
			found.push({ code, name, start, anchor: start });
		}
	return found;
}
