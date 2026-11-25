// Svelte's own `mount` and `unmount`, reached by the app's code: imported or re-exported by name,
// or read from a namespace import of `svelte`. They work with the web's DOM; the ones from
// `@sohedra/lynx` mount on Lynx's page, with its renderer.

import { field, identifierName, nodes } from "../../svelte/build/index.ts";
import type { AnyNode } from "../../svelte/build/index.ts";

/** The names `svelte` and `@sohedra/lynx` both export, which only the binding's draw on Lynx. */
const SVELTE_ONLY_ON_WEB: ReadonlySet<string> = new Set(["mount", "unmount"]);

/** A use of Svelte's `mount` or `unmount`: its name, where it starts, and its statement's start. */
export interface SvelteMountUse {
	name: string;
	start: number;
	/** Where the import or export it is part of starts, for a silencing comment above it. */
	anchor: number;
}

/** Whether `node` is a statement that imports or re-exports values from `svelte`. */
const fromSvelte = (node: AnyNode, type: string): boolean =>
	node.type === type &&
	field(node, "source")?.value === "svelte" &&
	node.importKind !== "type" &&
	node.exportKind !== "type";

/** The name a member expression reads, by `.name` or `["name"]`. */
function memberName(node: AnyNode): string | undefined {
	const property = field(node, "property");
	if (!node.computed) return identifierName(property);
	return typeof property?.value === "string" ? property.value : undefined;
}

/**
 * Every use of Svelte's `mount` or `unmount` in the programs, as written: a named import, a
 * re-export, or a read of a namespace import of `svelte` (`svelte.mount(…)`).
 */
export function svelteMountUses(programs: readonly (AnyNode | undefined)[]): SvelteMountUse[] {
	const found: SvelteMountUse[] = [];
	const namespaces = new Set<string>();
	for (const program of programs) {
		// Boundary: the program's statements are read by shape.
		for (const node of (program?.body ?? []) as AnyNode[]) {
			const anchor = node.start ?? 0;
			if (fromSvelte(node, "ImportDeclaration")) {
				for (const specifier of node.specifiers as AnyNode[]) {
					if (specifier.type === "ImportNamespaceSpecifier") {
						const local = identifierName(field(specifier, "local"));
						if (local !== undefined) namespaces.add(local);
					}
					if (specifier.type !== "ImportSpecifier" || specifier.importKind === "type") continue;
					const name = identifierName(field(specifier, "imported"));
					if (name !== undefined && SVELTE_ONLY_ON_WEB.has(name))
						found.push({ name, start: specifier.start ?? anchor, anchor });
				}
			}
			if (fromSvelte(node, "ExportNamedDeclaration")) {
				for (const specifier of node.specifiers as AnyNode[]) {
					if (specifier.exportKind === "type") continue;
					const name = identifierName(field(specifier, "local"));
					if (name !== undefined && SVELTE_ONLY_ON_WEB.has(name))
						found.push({ name, start: specifier.start ?? anchor, anchor });
				}
			}
		}
	}
	if (namespaces.size === 0) return found;
	for (const program of programs)
		for (const node of nodes(program)) {
			if (node.type !== "MemberExpression") continue;
			const object = identifierName(field(node, "object"));
			const name = memberName(node);
			if (object === undefined || !namespaces.has(object) || name === undefined) continue;
			const start = node.start ?? 0;
			if (SVELTE_ONLY_ON_WEB.has(name)) found.push({ name, start, anchor: start });
		}
	return found;
}
