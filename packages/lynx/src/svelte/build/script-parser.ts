// The parser Svelte reads a component's scripts with, for plain modules.

import { createRequire } from "node:module";
import path from "node:path";

/** Parses a script to an ESTree program (with positions and `loc`), TypeScript's nodes included. */
export type ScriptParser = (source: string, typescript: boolean) => unknown;

/** The parts of acorn this reads; it is Svelte's dependency, and has no types here. */
interface AcornParser {
	parse(source: string, options: object): unknown;
	extend(plugin: unknown): AcornParser;
}
interface Acorn {
	Parser: AcornParser;
}
interface AcornTypeScript {
	tsPlugin(): unknown;
}

const parsers = new Map<string, ScriptParser>();

/**
 * The parser Svelte reads a component's scripts with: acorn and its TypeScript plugin, both
 * Svelte's own dependencies, taken from the Svelte of the app in `root`.
 *
 * @workaround script-parser-from-svelte kind=svelte-internal delete-when="Svelte exports its script parser, or the binding depends on acorn and its TypeScript plugin itself"
 */
export function scriptParser(root: string): ScriptParser {
	const svelte = createRequire(path.join(root, "package.json")).resolve("svelte/compiler");
	let parser = parsers.get(svelte);
	if (!parser) {
		const fromSvelte = createRequire(svelte);
		// Boundary: Svelte's own dependencies are loaded by name and have no types here.
		const acorn = fromSvelte("acorn") as Acorn;
		const typed = acorn.Parser.extend(
			(fromSvelte("@sveltejs/acorn-typescript") as AcornTypeScript).tsPlugin(),
		);
		parser = (source, typescript) => {
			const read = (sourceType: "module" | "script"): unknown =>
				(typescript ? typed : acorn.Parser).parse(source, {
					sourceType,
					ecmaVersion: "latest",
					locations: true,
				});
			try {
				return read("module");
			} catch (error) {
				// A script that is not a module (CommonJS in a dependency) may use what modules
				// forbid. The module's error is the one to report.
				try {
					return read("script");
				} catch {
					throw error;
				}
			}
		};
		parsers.set(svelte, parser);
	}
	return parser;
}
