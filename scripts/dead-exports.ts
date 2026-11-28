// No exported value in the primitives' `src/` goes unused: another file of the primitives (source or
// test) imports it, or a platform package's public entry reaches it. Imports are followed through
// `index.ts` re-exports, `export *` and namespaces. Types don't count: this is about code.
//
//   node scripts/dead-exports.ts

import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";

import { codeText } from "./code-text.ts";
import { type Finding, unexempted } from "./exemptions.ts";
import { PRIMITIVES } from "./primitives-layout.ts";
import { sourceFiles } from "./source-files.ts";

/** The platform packages, whose entries are the public API users import. */
const PLATFORMS = new Set(["primitives-web", "primitives-lynx"]);
const SPECIFIER = String.raw`["']([^"']+)["']`;
const NAMED = new RegExp(
	String.raw`\b(import|export)\s+(?:type\s+)?\{([^}]*)\}\s*from\s*${SPECIFIER}`,
	"g",
);
const STAR = new RegExp(
	String.raw`\b(import|export)\s+\*\s*(?:as\s+([\w$]+)\s*)?from\s*${SPECIFIER}`,
	"g",
);
const DYNAMIC = new RegExp(String.raw`\bimport\(\s*${SPECIFIER}\s*\)`, "g");
const DECLARED =
	/^export\s+(?:declare\s+)?(?:(?:async\s+)?function\*?|(?:abstract\s+)?class|const|let|enum)\s+([\w$]+)/gm;
const LOCAL = /^export\s+\{([^}]*)\}\s*;?$/gm;

/** Exports with no user, keyed `<file>#<name>`, each with why, or "todo:" to fix. */
const FIELD_FAMILY =
	"Form code kept for the Field family, the next to move in, where it gets its users.";
const EXEMPTIONS: Record<string, string> = {
	"packages/primitives-core/src/foundation/form/form-null.ts#DEFAULT_FIELD_ROOT_STATE":
		FIELD_FAMILY,
	"packages/primitives-core/src/foundation/form/form-null.ts#NULL_FORM": FIELD_FAMILY,
	"packages/primitives-core/src/foundation/form/form-null.ts#NULL_FIELD_ITEM": FIELD_FAMILY,
	"packages/primitives-core/src/foundation/form/form-validity.ts#VALIDITY_KEYS": FIELD_FAMILY,
	"packages/primitives-core/src/foundation/form/form-validity.ts#makeValidityState": FIELD_FAMILY,
	"packages/primitives-core/src/foundation/form/form-validity.ts#getCombinedFieldValidityData":
		FIELD_FAMILY,
	"packages/primitives-core/src/foundation/form/form-validity.ts#NULL_VALIDITY_SOURCE":
		FIELD_FAMILY,
	"packages/primitives-web/src/foundation/kernel/kernel-change-details.ts#createGenericEventDetails":
		"Form.Root, in the form family that moves in next, passes it to `onFormSubmit`.",
};

/** A module: what it declares, what it re-exports and what it imports. */
interface Module {
	declared: Set<string>;
	/** Exported name → the module and name it comes from. */
	reexports: Map<string, { from: string; name: string }>;
	/** Modules whose every export this one re-exports. */
	stars: string[];
	/** Exported namespace name → the module it holds. */
	namespaces: Map<string, string>;
	/** Each module imported by name, with the names. */
	imports: { from: string; names: string[] }[];
	/** Modules imported whole (`import * as`, `import()`). */
	whole: string[];
}

/** Exported values in the primitives packages of `root` that nothing uses. */
export function checkDeadExports(root: string): string[] {
	const modules = new Map<string, Module>();
	const resolver = specifierResolver(root);
	for (const pkg of PRIMITIVES) {
		const dir = join(root, "packages", pkg);
		if (!existsSync(dir)) continue;
		for (const { file, path } of sourceFiles(root, { under: dir, names: /\.(?:ts|svelte|js)$/ })) {
			if (file.endsWith(".d.ts")) continue;
			modules.set(file, parse(readFileSync(path, "utf8"), file, resolver));
		}
	}
	const used = new Set<string>();
	const seen = new Set<string>();
	const markAll = (file: string): void => {
		if (seen.has(`*${file}`)) return;
		seen.add(`*${file}`);
		const module = modules.get(file);
		if (module === undefined) return;
		for (const name of module.declared) used.add(`${file}#${name}`);
		for (const [name] of module.reexports) mark(file, name);
		for (const target of module.stars) markAll(target);
		for (const target of module.namespaces.values()) markAll(target);
	};
	const mark = (file: string, name: string): void => {
		if (seen.has(`${file}#${name}`)) return;
		seen.add(`${file}#${name}`);
		const module = modules.get(file);
		if (module === undefined) return;
		if (module.declared.has(name)) used.add(`${file}#${name}`);
		const reexport = module.reexports.get(name);
		if (reexport !== undefined) mark(reexport.from, reexport.name);
		const namespace = module.namespaces.get(name);
		if (namespace !== undefined) markAll(namespace);
		for (const target of module.stars) mark(target, name);
	};
	for (const [file, module] of modules) {
		for (const { from, names } of module.imports) {
			for (const name of names) if (from !== file) mark(from, name);
		}
		for (const target of module.whole) markAll(target);
	}
	for (const entry of publicEntries(root)) markAll(entry);

	const findings: Finding[] = [];
	for (const [file, module] of modules) {
		if (!/^packages\/[^/]+\/src\//.test(file)) continue;
		for (const name of module.declared) {
			if (used.has(`${file}#${name}`)) continue;
			findings.push({
				key: `${file}#${name}`,
				message: `${file}: nothing uses the export ${name}. Delete it, stop exporting it, or move it in with the code that will use it.`,
			});
		}
	}
	return unexempted(findings, EXEMPTIONS, "scripts/dead-exports.ts");
}

function parse(
	text: string,
	file: string,
	resolve: (from: string, specifier: string) => string | undefined,
): Module {
	const { code } = codeText(text, file);
	const module: Module = {
		declared: new Set(),
		reexports: new Map(),
		stars: [],
		namespaces: new Map(),
		imports: [],
		whole: [],
	};
	const names = (list: string): { local: string; exported: string }[] =>
		list
			.split(",")
			.map((item) => item.trim().replace(/^type\s+/, ""))
			.filter((item) => item !== "")
			.map((item) => {
				const [local, exported] = item.split(/\s+as\s+/);
				return { local: local!, exported: exported ?? local! };
			});
	for (const [, keyword, list, specifier] of code.matchAll(NAMED)) {
		const from = resolve(file, specifier!);
		if (from === undefined) continue;
		const items = names(list!);
		if (keyword === "import") {
			module.imports.push({ from, names: items.map((item) => item.local) });
		} else {
			for (const { local, exported } of items)
				module.reexports.set(exported, { from, name: local });
		}
	}
	for (const [, keyword, namespace, specifier] of code.matchAll(STAR)) {
		const from = resolve(file, specifier!);
		if (from === undefined) continue;
		if (keyword === "import") module.whole.push(from);
		else if (namespace === undefined) module.stars.push(from);
		else module.namespaces.set(namespace, from);
	}
	for (const [, specifier] of code.matchAll(DYNAMIC)) {
		const from = resolve(file, specifier!);
		if (from !== undefined) module.whole.push(from);
	}
	for (const [, name] of code.matchAll(DECLARED)) module.declared.add(name!);
	for (const [, list] of code.matchAll(LOCAL)) {
		for (const { local, exported } of names(list!)) {
			if (local === exported) module.declared.add(local);
		}
	}
	return module;
}

/** Resolves an import specifier, as the packages' bundler does, to a file path from `root`. */
function specifierResolver(root: string): (from: string, specifier: string) => string | undefined {
	const manifests = new Map<
		string,
		{ dir: string; exports: Record<string, unknown>; imports: Record<string, string> }
	>();
	for (const pkg of PRIMITIVES) {
		const path = join(root, "packages", pkg, "package.json");
		if (!existsSync(path)) continue;
		// Boundary: JSON has no type; only these two fields are read.
		const manifest = JSON.parse(readFileSync(path, "utf8")) as {
			name: string;
			exports?: Record<string, unknown>;
			imports?: Record<string, string>;
		};
		manifests.set(manifest.name, {
			dir: `packages/${pkg}`,
			exports: manifest.exports ?? {},
			imports: manifest.imports ?? {},
		});
	}
	const asFile = (path: string): string | undefined => {
		const candidates = [path, path.replace(/\.js$/, ".ts"), `${path}.ts`, join(path, "index.ts")];
		return candidates
			.find(
				(candidate) =>
					existsSync(join(root, candidate)) && statSync(join(root, candidate)).isFile(),
			)
			?.replaceAll("\\", "/");
	};
	const target = (value: unknown): string | undefined =>
		typeof value === "string"
			? value
			: typeof value === "object" && value !== null
				? target((value as Record<string, unknown>).default)
				: undefined;
	return (from, specifier) => {
		if (specifier.startsWith(".")) return asFile(join(dirname(from), specifier));
		const pkg = [...manifests.entries()].find(
			([name]) => specifier === name || specifier.startsWith(`${name}/`),
		);
		if (pkg !== undefined) {
			const [name, { dir, exports }] = pkg;
			const path = target(exports[`.${specifier.slice(name.length)}`]);
			return path === undefined ? undefined : asFile(join(dir, path));
		}
		if (specifier.startsWith("#")) {
			const owner = [...manifests.values()].find(({ dir }) => from.startsWith(`${dir}/`));
			if (owner === undefined) return undefined;
			const exact = owner.imports[specifier];
			if (exact !== undefined) return asFile(join(owner.dir, exact));
			const wildcard = Object.entries(owner.imports).find(
				([key]) => key.endsWith("/*") && specifier.startsWith(key.slice(0, -1)),
			);
			if (wildcard === undefined) return undefined;
			return asFile(
				join(owner.dir, wildcard[1].replace("*", specifier.slice(wildcard[0].length - 1))),
			);
		}
		return undefined;
	};
}

/** The files each platform package's `exports` map points at: what users import. */
function publicEntries(root: string): string[] {
	const entries: string[] = [];
	for (const pkg of PLATFORMS) {
		const path = join(root, "packages", pkg, "package.json");
		if (!existsSync(path)) continue;
		// Boundary: JSON has no type; only `exports` is read.
		const { exports = {} } = JSON.parse(readFileSync(path, "utf8")) as {
			exports?: Record<string, unknown>;
		};
		for (const value of Object.values(exports)) {
			const file = typeof value === "string" ? value : (value as Record<string, unknown>).default;
			if (typeof file === "string") {
				entries.push(relative(root, join(root, "packages", pkg, file)).replaceAll("\\", "/"));
			}
		}
	}
	return entries;
}

if (import.meta.main) {
	const problems = checkDeadExports(".");
	for (const problem of problems) console.error(problem);
	process.exit(problems.length > 0 ? 1 : 0);
}
