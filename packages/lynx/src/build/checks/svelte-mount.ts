// Svelte's own `mount` and `unmount`, imported by the app's code. They work with the web's DOM; the
// ones from `@sohedra/lynx` mount on Lynx's page, with its renderer.

import { field, identifierName } from "../../svelte/build/index.ts";
import type { AnyNode } from "../../svelte/build/index.ts";

/** The names `svelte` and `@sohedra/lynx` both export, which only the binding's draw on Lynx. */
const SVELTE_ONLY_ON_WEB: ReadonlySet<string> = new Set(["mount", "unmount"]);

/** An import of Svelte's `mount` or `unmount`: the name it imports and where it starts. */
export interface SvelteMountImport {
	name: string;
	start: number;
}

/** Every import of Svelte's `mount` or `unmount` in the programs, as written. */
export function svelteMountImports(
	programs: readonly (AnyNode | undefined)[],
): SvelteMountImport[] {
	const found: SvelteMountImport[] = [];
	for (const program of programs) {
		// Boundary: the program's statements are read by shape.
		for (const node of (program?.body ?? []) as AnyNode[]) {
			if (node.type !== "ImportDeclaration" || field(node, "source")?.value !== "svelte") continue;
			if (node.importKind === "type") continue;
			for (const specifier of node.specifiers as AnyNode[]) {
				if (specifier.type !== "ImportSpecifier" || specifier.importKind === "type") continue;
				const name = identifierName(field(specifier, "imported"));
				if (name !== undefined && SVELTE_ONLY_ON_WEB.has(name))
					found.push({ name, start: specifier.start ?? node.start ?? 0 });
			}
		}
	}
	return found;
}
