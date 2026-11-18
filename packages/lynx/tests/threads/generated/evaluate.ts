// Runs a generated page's compiled components, one thread's copy, with the modules they import
// given by the caller: the thread's own, from the layer the caller was bundled in. Svelte's output
// imports in four shapes and exports its component as the default; nothing else is read.

/** A module as its importer sees it: its exports by name. */
export type ModuleExports = Readonly<Record<string, unknown>>;

/** The specifier generated components import Svelte's runtime by, on either thread. */
export const INTERNALS = "generated:internals";

/**
 * The specifier of the module a generated component records its `$props.id()` with, as
 * `recordId(component, id)`: a test module, not the binding's.
 */
export const IDS = "generated:ids";

/** The specifier of the custom renderer, as the build gives it to the background's copy. */
export const RENDERER = "@sohedra/lynx/internal/renderer";

/** One thread's compiled page: each component's module text, children before their parents. */
export interface CompiledPage {
	/** `[file, code]` in the order they run; the last is the page's root component. */
	readonly modules: readonly (readonly [file: string, code: string])[];
}

const IMPORT =
	/^import\s+(?:(?:\*\s+as\s+([\w$]+)|([\w$]+)|\{([^}]*)\})\s+from\s+)?(['"])([^'"]+)\4;?[ \t]*$/gm;
const EXPORT_DEFAULT_FUNCTION = /^export default function ([\w$]+)/m;
const EXPORT_DEFAULT_NAME = /^export default ([\w$]+);?[ \t]*$/m;

/** The bindings of one import, as declarations that read `__module(specifier)`. */
function bindings(match: RegExpExecArray): string {
	const [, namespace, name, named, , specifier] = match;
	const module = `__module(${JSON.stringify(specifier)})`;
	if (namespace) return `const ${namespace} = ${module};`;
	if (name) return `const ${name} = ${module}.default;`;
	if (named !== undefined) {
		const parts = named
			.split(",")
			.map((part) => part.trim())
			.filter(Boolean)
			.map((part) => {
				const [imported, local] = part.split(/\s+as\s+/);
				return local ? `${imported}: ${local}` : imported;
			});
		return `const { ${parts.join(", ")} } = ${module};`;
	}
	return `${module};`;
}

/** A module's text as a function body that takes `__module` and returns the default export. */
function asFunctionBody(code: string): string {
	const declarations: string[] = [];
	let body = code.replace(IMPORT, (...args: unknown[]) => {
		// Boundary: `replace` hands the match's groups as loose arguments.
		const match = args.slice(0, 6) as unknown as RegExpExecArray;
		declarations.push(bindings(match));
		return "";
	});
	const declared = EXPORT_DEFAULT_FUNCTION.exec(body);
	if (declared) {
		body = body.replace(EXPORT_DEFAULT_FUNCTION, `function ${declared[1]}`);
		body += `\nreturn ${declared[1]};`;
	} else {
		const named = EXPORT_DEFAULT_NAME.exec(body);
		if (!named) throw new Error("A generated component has no default export.");
		body = body.replace(EXPORT_DEFAULT_NAME, `return ${named[1]};`);
	}
	if (/^\s*(?:import|export)\s/m.test(body))
		throw new Error(`A generated component has an import or export this cannot read:\n${body}`);
	return `${declarations.join("\n")}\n${body}`;
}

/**
 * Runs `page`'s modules in order, each import read from `modules` or from a component run before
 * it (`./Name.svelte`), and returns the root component.
 */
export function evaluatePage(page: CompiledPage, modules: Record<string, ModuleExports>): unknown {
	const known: Record<string, ModuleExports> = { ...modules };
	let root: unknown;
	for (const [file, code] of page.modules) {
		// Boundary: the module's text is Svelte's compiler's, from a page the test generated.
		// oxlint-disable-next-line no-new-func, typescript/no-implied-eval -- compiled as the test runs
		const run = new Function("__module", asFunctionBody(code)) as (
			module: (specifier: string) => ModuleExports,
		) => unknown;
		root = run((specifier) => {
			const found = known[specifier];
			if (!found)
				throw new Error(`A generated component imports ${specifier}, which is not given.`);
			return found;
		});
		known[`./${file}`] = { default: root };
	}
	return root;
}
