// Svelte's exports and modules that fail on Lynx, reached by the app's code. Svelte's own `mount`,
// `unmount` and `hydrate` work with the web's DOM; on Lynx, the binding's `mountPage` mounts the
// page over its first frame, and its `mount` and `unmount` add and remove layers above it.
// `MediaQuery` from `svelte/reactivity` calls the web's `matchMedia` as it is made, which neither
// thread has. `svelte/motion` and `svelte/reactivity/window` read the web's `window` as they load,
// so any import of them is refused, a side effect or a dynamic import included.
//
// Known gaps, which the build leaves to the page's start to report: a refused export destructured
// from a namespace or from a dynamic import, or imported through the app's own `export *` of its
// module; and a parameter that shadows a namespace import is refused as if it were the namespace.

// Only their published types: the refused names must be exports of the installed Svelte.
import type * as SvelteExports from "svelte";
import type * as ReactivityExports from "svelte/reactivity";

import { field, identifierName, nodes } from "../../svelte/build/index.ts";
import type {
	AnyNode,
	ImportKinds,
	ScriptExpression,
	ScriptStatement,
} from "../../svelte/build/index.ts";
import type { SvelteMountName, UnsupportedSvelteModule } from "../diagnostics/catalogue-checks.ts";
import type { Report } from "../diagnostics/messages.ts";
import type { ScriptRoots } from "./script-uses.ts";

/** The codes a use of Svelte's is refused with. */
type RefusedCode = "svelte_mount_imported" | "media_query_imported" | "svelte_module_unsupported";

/** What a refused use is reported as, before its place is known. */
type RefusedReport = { [Code in RefusedCode]: Omit<Report<Code>, "place"> }[RefusedCode];

/** The refused exports of a module, out of the ones its published types declare. */
type RefusedOf<Module> = Partial<Record<keyof Module, RefusedReport>>;

/** The report of a use of Svelte's `name`, which puts a component on the web's DOM. */
const mounting = (name: SvelteMountName): RefusedReport => ({
	code: "svelte_mount_imported",
	details: { name },
});

/** Svelte's exports that fail on Lynx, by module, each with its report. */
const REFUSED_EXPORTS = {
	svelte: {
		mount: mounting("mount"),
		unmount: mounting("unmount"),
		hydrate: mounting("hydrate"),
	} satisfies Record<SvelteMountName, RefusedReport>,
	"svelte/reactivity": { MediaQuery: { code: "media_query_imported", details: {} } },
} satisfies {
	svelte: RefusedOf<typeof SvelteExports>;
	"svelte/reactivity": RefusedOf<typeof ReactivityExports>;
};

/** Svelte's modules that fail on Lynx as they load: any import of them is refused. */
const REFUSED_MODULES: Readonly<Record<UnsupportedSvelteModule, true>> = {
	"svelte/motion": true,
	"svelte/reactivity/window": true,
};

/** Whether `key` is one of `table`'s own keys. */
const ownKey = <Table extends object>(table: Table, key: string): key is keyof Table & string =>
	Object.hasOwn(table, key);

/** A use of a refused export or module: its report, where it starts, and where to silence it. */
export interface RefusedSvelteUse {
	report: RefusedReport;
	start: number;
	/** Where the statement or the element it is part of starts, for a silencing comment above it. */
	anchor: number;
}

/** The report for `name` of `module`, or `undefined` when it works on Lynx. */
function refusedExport(
	module: string | undefined,
	name: string | undefined,
): RefusedReport | undefined {
	if (module === undefined || name === undefined || !ownKey(REFUSED_EXPORTS, module))
		return undefined;
	const names: Readonly<Record<string, RefusedReport>> = REFUSED_EXPORTS[module];
	return Object.hasOwn(names, name) ? names[name] : undefined;
}

/** The report for any import of `module`, or `undefined` when it loads on Lynx. */
function refusedModule(module: string | undefined): RefusedReport | undefined {
	if (module === undefined || !ownKey(REFUSED_MODULES, module)) return undefined;
	return { code: "svelte_module_unsupported", details: { module } };
}

/** A statement that imports or re-exports from a module, with acorn-typescript's fields. */
type ModuleStatement = Extract<
	ScriptStatement,
	{ type: "ImportDeclaration" | "ExportNamedDeclaration" | "ExportAllDeclaration" }
> &
	ImportKinds;

/** A specifier of an import or an export, with acorn-typescript's fields. */
type Specifier = (
	| Extract<ModuleStatement, { type: "ImportDeclaration" }>["specifiers"][number]
	| Extract<ModuleStatement, { type: "ExportNamedDeclaration" }>["specifiers"][number]
) &
	ImportKinds;

/** Where a node starts in the file's text. */
function startOf(node: object | null | undefined): number | undefined {
	// Boundary: estree's types leave out the positions acorn gives every node.
	return (node as AnyNode | null | undefined)?.start;
}

/** The name an import's or export's specifier gives: an identifier, or a string (`"a-b" as c`). */
function specifierName(node: { type: string; name?: string; value?: unknown }): string {
	return node.type === "Identifier" ? String(node.name) : String(node.value);
}

/** The module a dynamic `import()` names, as a string or a template with no `${}`. */
function importedModule(source: ScriptExpression): string | undefined {
	if (source.type === "Literal") return typeof source.value === "string" ? source.value : undefined;
	if (source.type === "TemplateLiteral" && source.expressions.length === 0)
		return source.quasis[0]?.value.cooked ?? undefined;
	return undefined;
}

/** The name a member expression reads, by `.name` or `["name"]`. */
function memberName(node: AnyNode): string | undefined {
	const property = field(node, "property");
	if (!node.computed) return identifierName(property);
	return typeof property?.value === "string" ? property.value : undefined;
}

/** The uses one import or export statement makes of a refused export or module. */
function statementUses(
	statement: ModuleStatement,
	namespaces: Map<string, string>,
): RefusedSvelteUse[] {
	if (statement.importKind === "type" || statement.exportKind === "type") return [];
	const module = statement.source?.value;
	if (typeof module !== "string") return [];
	const anchor = startOf(statement) ?? 0;
	const specifiers: Specifier[] = "specifiers" in statement ? statement.specifiers : [];
	const whole = refusedModule(module);
	if (whole !== undefined) {
		if (
			specifiers.length > 0 &&
			specifiers.every((each) => each.importKind === "type" || each.exportKind === "type")
		)
			return [];
		return [{ report: whole, start: startOf(statement.source) ?? anchor, anchor }];
	}
	if (statement.type === "ExportAllDeclaration") return [];
	const found: RefusedSvelteUse[] = [];
	for (const specifier of specifiers) {
		if (specifier.importKind === "type" || specifier.exportKind === "type") continue;
		if (specifier.type === "ImportNamespaceSpecifier") {
			if (ownKey(REFUSED_EXPORTS, module)) namespaces.set(specifier.local.name, module);
			continue;
		}
		if (specifier.type === "ImportDefaultSpecifier") continue;
		const name = specifierName(
			specifier.type === "ImportSpecifier" ? specifier.imported : specifier.local,
		);
		const report = refusedExport(module, name);
		if (report !== undefined) found.push({ report, start: startOf(specifier) ?? anchor, anchor });
	}
	return found;
}

/**
 * Every use of a refused export or module of Svelte's in a file's code, as written: a named import
 * or re-export of a refused export, or a read of it from a namespace import (`svelte.mount(…)`), in
 * the scripts or the markup; and any import of a refused module, `import()` included.
 */
export function refusedSvelteUses({ programs, expressions = [] }: ScriptRoots): RefusedSvelteUse[] {
	const found: RefusedSvelteUse[] = [];
	/** The namespace imports of a module with refused exports: their local name, and the module. */
	const namespaces = new Map<string, string>();
	for (const program of programs) {
		// Boundary: Svelte publishes the programs as estree's `Program`, whose types lack the
		// `importKind` and `exportKind` that acorn-typescript adds.
		for (const statement of (program?.body ?? []) as (ScriptStatement & ImportKinds)[]) {
			if (
				statement.type === "ImportDeclaration" ||
				statement.type === "ExportNamedDeclaration" ||
				statement.type === "ExportAllDeclaration"
			)
				found.push(...statementUses(statement, namespaces));
		}
	}
	const roots = [
		...programs.map((program) => ({ node: program, anchor: undefined })),
		...expressions.map(({ node, anchor }) => ({ node, anchor })),
	];
	for (const root of roots)
		for (const node of nodes(root.node)) {
			let report: RefusedReport | undefined;
			if (node.type === "ImportExpression")
				// Boundary: the walk gives nodes by shape; this one is estree's `ImportExpression`.
				report = refusedModule(
					importedModule(
						(node as unknown as Extract<ScriptExpression, { type: "ImportExpression" }>).source,
					),
				);
			else if (node.type === "MemberExpression" && namespaces.size > 0) {
				const object = identifierName(field(node, "object"));
				report = refusedExport(
					object === undefined ? undefined : namespaces.get(object),
					memberName(node),
				);
			}
			if (report === undefined) continue;
			const start = node.start ?? 0;
			found.push({ report, start, anchor: root.anchor ?? start });
		}
	return found;
}
