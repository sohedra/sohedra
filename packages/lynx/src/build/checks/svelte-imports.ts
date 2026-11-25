// Svelte's exports and modules that fail on Lynx, reached by the app's code. Svelte's own `mount`,
// `unmount` and `hydrate` work with the web's DOM; the binding's `mount` and `unmount` from
// `@sohedra/lynx` work on Lynx's page, with its renderer, and its `mount` hydrates the first frame
// itself. `MediaQuery` from `svelte/reactivity` calls the web's `matchMedia` as it is made, which
// neither thread has. `svelte/motion` and `svelte/reactivity/window` read the web's `window` as
// they load, so any import of them is refused, a side effect or a dynamic import included.

import { field, identifierName, nodes } from "../../svelte/build/index.ts";
import type { AnyNode } from "../../svelte/build/index.ts";
import type { Report } from "../diagnostics/messages.ts";

/** The codes an export of Svelte's is refused with. */
type ExportCode = "svelte_mount_imported" | "media_query_imported";

/** Svelte's exports that fail on Lynx, by module, and the code each is refused with. */
const REFUSED_EXPORTS: Readonly<Record<string, Readonly<Record<string, ExportCode>>>> = {
	svelte: {
		mount: "svelte_mount_imported",
		unmount: "svelte_mount_imported",
		hydrate: "svelte_mount_imported",
	},
	"svelte/reactivity": { MediaQuery: "media_query_imported" },
};

/** Svelte's modules that fail on Lynx as they load: any import of them is refused. */
const REFUSED_MODULES: ReadonlySet<string> = new Set(["svelte/motion", "svelte/reactivity/window"]);

/** The codes a use of Svelte's is refused with. */
type RefusedCode = ExportCode | "svelte_module_unsupported";

/** What a refused use is reported as, before its place is known. */
type RefusedReport = { [Code in RefusedCode]: Omit<Report<Code>, "place"> }[RefusedCode];

/** A refused use: its report, where it starts, and its statement's start. */
export interface RefusedSvelteUse {
	report: RefusedReport;
	start: number;
	/** Where the import or export it is part of starts, for a silencing comment above it. */
	anchor: number;
}

/** The report for `name` of `module`, or `undefined` when it works on Lynx. */
function refusedExport(
	module: string | undefined,
	name: string | undefined,
): RefusedReport | undefined {
	if (module === undefined || name === undefined || !Object.hasOwn(REFUSED_EXPORTS, module))
		return undefined;
	const names = REFUSED_EXPORTS[module]!;
	return Object.hasOwn(names, name) ? { code: names[name]!, details: { name } } : undefined;
}

/** The module a statement imports or re-exports values from, or `undefined` for any other. */
function valuesFrom(node: AnyNode): string | undefined {
	if (
		node.type !== "ImportDeclaration" &&
		node.type !== "ExportNamedDeclaration" &&
		node.type !== "ExportAllDeclaration"
	)
		return undefined;
	if (node.importKind === "type" || node.exportKind === "type") return undefined;
	const source = field(node, "source")?.value;
	return typeof source === "string" ? source : undefined;
}

/** Whether a specifier names a type only (`import { type A }`). */
const typeOnly = (specifier: AnyNode): boolean =>
	specifier.importKind === "type" || specifier.exportKind === "type";

/** The name a member expression reads, by `.name` or `["name"]`. */
function memberName(node: AnyNode): string | undefined {
	const property = field(node, "property");
	if (!node.computed) return identifierName(property);
	return typeof property?.value === "string" ? property.value : undefined;
}

/** A use of a refused module by the statement `node`, at its source, unless it imports types only. */
function moduleUse(node: AnyNode, module: string): RefusedSvelteUse | undefined {
	// Boundary: the statement's specifiers are read by shape.
	const specifiers = (node.specifiers ?? []) as AnyNode[];
	if (specifiers.length > 0 && specifiers.every(typeOnly)) return undefined;
	const anchor = node.start ?? 0;
	return {
		report: { code: "svelte_module_unsupported", details: { module } },
		start: field(node, "source")?.start ?? anchor,
		anchor,
	};
}

/**
 * Every refused use of Svelte's in the programs, as written: a named import or re-export of a
 * refused export, or a read of it from a namespace import (`svelte.mount(…)`); and any import of a
 * refused module.
 */
export function refusedSvelteUses(programs: readonly (AnyNode | undefined)[]): RefusedSvelteUse[] {
	const found: RefusedSvelteUse[] = [];
	/** The namespace imports of a module with refused exports: their local name, and the module. */
	const namespaces = new Map<string, string>();
	for (const program of programs) {
		// Boundary: the program's statements are read by shape.
		for (const node of (program?.body ?? []) as AnyNode[]) {
			const module = valuesFrom(node);
			if (module === undefined) continue;
			if (REFUSED_MODULES.has(module)) {
				const use = moduleUse(node, module);
				if (use !== undefined) found.push(use);
				continue;
			}
			if (!Object.hasOwn(REFUSED_EXPORTS, module) || node.type === "ExportAllDeclaration") continue;
			const anchor = node.start ?? 0;
			const imports = node.type === "ImportDeclaration";
			for (const specifier of node.specifiers as AnyNode[]) {
				if (specifier.type === "ImportNamespaceSpecifier") {
					const local = identifierName(field(specifier, "local"));
					if (local !== undefined) namespaces.set(local, module);
					continue;
				}
				if ((imports && specifier.type !== "ImportSpecifier") || typeOnly(specifier)) continue;
				const report = refusedExport(
					module,
					identifierName(field(specifier, imports ? "imported" : "local")),
				);
				if (report !== undefined) found.push({ report, start: specifier.start ?? anchor, anchor });
			}
		}
	}
	for (const program of programs)
		for (const node of nodes(program)) {
			if (node.type === "ImportExpression") {
				const source = field(node, "source")?.value;
				if (typeof source === "string" && REFUSED_MODULES.has(source)) {
					const start = node.start ?? 0;
					found.push({
						report: { code: "svelte_module_unsupported", details: { module: source } },
						start,
						anchor: start,
					});
				}
				continue;
			}
			if (namespaces.size === 0 || node.type !== "MemberExpression") continue;
			const object = identifierName(field(node, "object"));
			const report = refusedExport(
				object === undefined ? undefined : namespaces.get(object),
				memberName(node),
			);
			if (report === undefined) continue;
			const start = node.start ?? 0;
			found.push({ report, start, anchor: start });
		}
	return found;
}
