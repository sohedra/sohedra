// The declarations an app gets: one file for each public entry in `types/bundled/` (`index.d.ts` for
// the package itself, `host.d.ts`, `config/rsbuild.d.ts` and the rest), bundled by dts-buddy from
// the source, so that only what an entry exports reaches an app. They are committed: a change to the
// API shows in review as their diff, and a test fails while they differ from what this makes. The
// internal entries keep the declarations `tsc` writes next to their files.
//
// dts-buddy writes one `declare module` for each entry; each becomes a module file of its own, so an
// app loads only the entries it imports. A type two entries share is declared in each, except where
// the source imports it by its entry's name: that is how an augmentable interface (`InitData`,
// `HostEvents`) keeps the one declaration an app augments.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { createBundle } from "dts-buddy";
import { format } from "oxfmt";
import ts from "typescript";

const ROOT = path.resolve(import.meta.dirname, "../..");

/** The command that writes the declarations. */
export const DECLARATIONS_COMMAND = "pnpm -F @sohedra/lynx declarations";

/** A public entry whose declarations are bundled. */
export interface DeclaredEntry {
	/** The source file it is typed from: the background side of an entry that resolves by thread. */
	source: string;
	/** Where its declarations are written, from the package's folder. */
	declarations: string;
	/**
	 * Source files whose augmentations of another package (`declare module "svelte/events"`) the
	 * entry carries, which dts-buddy leaves out.
	 */
	augmentations?: readonly string[];
}

/** Each public entry whose declarations are bundled. */
export const DECLARED_ENTRIES: Readonly<Record<string, DeclaredEntry>> = {
	".": { source: "src/background/root-entry.ts", declarations: "types/bundled/index.d.ts" },
	"./host": {
		source: "src/background/host-entry.ts",
		declarations: "types/bundled/host.d.ts",
		augmentations: ["src/background/host/events.ts"],
	},
	"./env": { source: "src/env/index.ts", declarations: "types/bundled/env.d.ts" },
	"./gesture": { source: "src/gesture/index.ts", declarations: "types/bundled/gesture.d.ts" },
	"./experimental": {
		source: "src/gesture/experimental.ts",
		declarations: "types/bundled/experimental.d.ts",
	},
	"./testing": {
		source: "src/testing/library-entry.ts",
		declarations: "types/bundled/testing.d.ts",
	},
	"./config/rsbuild": {
		source: "src/build/plugin/index.ts",
		declarations: "types/bundled/config/rsbuild.d.ts",
	},
	"./config/rstest": {
		source: "src/build/presets/rstest.ts",
		declarations: "types/bundled/config/rstest.d.ts",
	},
	"./config/vitest": {
		source: "src/build/presets/vitest.ts",
		declarations: "types/bundled/config/vitest.d.ts",
	},
	"./config/svelte": {
		source: "src/build/svelte-config/index.ts",
		declarations: "types/bundled/config/svelte.d.ts",
	},
};

/** A file this writes: its path from the package's folder, and its text. */
export interface DeclarationFile {
	path: string;
	text: string;
}

/** An entry's module name: `@sohedra/lynx` and its subpath. */
const moduleName = (entry: string): string => `@sohedra/lynx${entry.slice(1)}`;

/** The top-level statements of `file` that `test` picks, as written. */
function statementsOf(file: string, test: (statement: ts.Statement) => boolean): string[] {
	const text = fs.readFileSync(path.join(ROOT, file), "utf8");
	const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
	return source.statements.filter(test).map((statement) => statement.getText(source));
}

/** The `export * from "…"` of a package in `file`, which dts-buddy leaves out. */
const wholeExports = (file: string): string[] =>
	statementsOf(
		file,
		(statement) =>
			ts.isExportDeclaration(statement) &&
			!statement.exportClause &&
			statement.moduleSpecifier !== undefined &&
			ts.isStringLiteral(statement.moduleSpecifier) &&
			!statement.moduleSpecifier.text.startsWith("."),
	);

/** The augmentations of another package in `file`: `declare module "…" { … }`. */
export const augmentationsIn = (file: string): string[] =>
	statementsOf(
		file,
		(statement) => ts.isModuleDeclaration(statement) && ts.isStringLiteral(statement.name),
	);

/**
 * The body of the bundle's `declare module` for `name`, as a module file: one tab less, and the
 * `declare` a declaration file asks of a top-level class, function, variable or namespace.
 */
function moduleBody(bundle: ts.SourceFile, name: string): string {
	const declaration = bundle.statements.find(
		(statement): statement is ts.ModuleDeclaration =>
			ts.isModuleDeclaration(statement) && statement.name.text === name,
	);
	const body = declaration?.body;
	if (!body || !ts.isModuleBlock(body)) throw new Error(`dts-buddy wrote no module ${name}.`);
	return bundle.text
		.slice(body.statements.pos, body.statements.end)
		.split("\n")
		.map((line) => line.replace(/^\t/, ""))
		.map((line) =>
			/^(?:abstract class|class|function|const|let|var|namespace|enum) /.test(line)
				? `declare ${line}`
				: line,
		)
		.join("\n");
}

/** Every file of declarations, as `pnpm -F @sohedra/lynx declarations` writes them. */
export async function bundleDeclarations(): Promise<DeclarationFile[]> {
	const work = fs.mkdtempSync(path.join(os.tmpdir(), "sohedra-lynx-declarations-"));
	const output = path.join(work, "index.d.ts");
	try {
		await createBundle({
			project: path.join(ROOT, "tsconfig.build.json"),
			output,
			modules: Object.fromEntries(
				Object.entries(DECLARED_ENTRIES).map(([entry, { source }]) => [
					moduleName(entry),
					path.join(ROOT, source),
				]),
			),
			// What is marked `@internal` stays out: the gesture classes' shared constructors.
			compilerOptions: { stripInternal: true },
		});
		const text = fs.readFileSync(output, "utf8");
		const bundle = ts.createSourceFile(output, text, ts.ScriptTarget.Latest, true);
		return await Promise.all(
			Object.entries(DECLARED_ENTRIES).map(async ([entry, declared]) => {
				const parts = [
					`// \`${moduleName(entry)}\`, bundled from the source by \`${DECLARATIONS_COMMAND}\`.`,
					...wholeExports(declared.source),
					moduleBody(bundle, moduleName(entry)),
					...(declared.augmentations ?? []).flatMap(augmentationsIn),
				];
				const { code, errors } = await format(declared.declarations, parts.join("\n\n"), {
					useTabs: true,
					sortImports: true,
				});
				if (errors.length > 0)
					throw new Error(`${declared.declarations} does not parse: ${errors[0]!.message}`);
				return { path: declared.declarations, text: code };
			}),
		);
	} finally {
		fs.rmSync(work, { recursive: true, force: true });
	}
}
