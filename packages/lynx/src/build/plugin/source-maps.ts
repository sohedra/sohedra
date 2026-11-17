// Source maps that tell a debugger which files are the binding's own, so that stepping and stack
// traces in the browser tools skip them (the `ignoreList` of the source map format).

import path from "node:path";
import { fileURLToPath } from "node:url";

import type { Rspack } from "@rsbuild/core";

import { PACKAGE_NAME } from "../../wire/index.ts";
import { PACKAGE_ROOT } from "./layers.ts";

/** The `file:` URL or path of a source as a path, or `undefined` for what is neither. */
function sourcePath(source: string): string | undefined {
	if (source.startsWith("file:")) {
		try {
			return fileURLToPath(source);
		} catch {
			// A URL no path is made of (a host that is not this machine's): not one of ours.
			return undefined;
		}
	}
	return path.isAbsolute(source) ? path.normalize(source) : undefined;
}

/**
 * Whether a source of a map is a file of this package: its program folders when this package's own
 * folder is the one built from (a repository), or the installed package's.
 */
export function isBindingSource(source: string): boolean {
	const file = sourcePath(source);
	if (file === undefined) return false;
	const inPackage = [path.join(PACKAGE_ROOT, "src"), path.join(PACKAGE_ROOT, "lib")].some(
		(folder) => file.startsWith(folder + path.sep),
	);
	return inPackage || file.split(path.sep).join("/").includes(`/node_modules/${PACKAGE_NAME}/`);
}

/** The indexes of the map's sources that are the binding's. */
export function bindingSourceIndexes(sources: readonly string[]): number[] {
	return sources.flatMap((source, index) => (isBindingSource(source) ? [index] : []));
}

/** A source map as far as this plugin reads it. */
interface SourceMapJson {
	sources?: string[];
	ignoreList?: number[];
	x_google_ignoreList?: number[];
}

const NAME = `${PACKAGE_NAME}:source-map-ignore-list`;

/**
 * Adds the binding's files to the `ignoreList` of every source map of the build, before the engine
 * collects them into its debug metadata. Lynx DevTool's older Chrome does not read the list; the
 * docs name the setting that does the same there.
 */
export class SourceMapIgnoreListPlugin {
	apply(compiler: Rspack.Compiler): void {
		const { Compilation, sources } = compiler.webpack;
		compiler.hooks.thisCompilation.tap(NAME, (compilation) => {
			compilation.hooks.processAssets.tap(
				// After the maps are made, before anything reads them.
				{ name: NAME, stage: Compilation.PROCESS_ASSETS_STAGE_DEV_TOOLING + 1 },
				() => {
					for (const { name } of compilation.getAssets()) {
						if (!name.endsWith(".map")) continue;
						compilation.updateAsset(name, (old) => {
							// Boundary: an asset's text is the map's JSON.
							const map = JSON.parse(String(old.source())) as SourceMapJson;
							const ignore = bindingSourceIndexes(map.sources ?? []);
							if (ignore.length === 0) return old;
							map.ignoreList = ignore;
							map.x_google_ignoreList = ignore;
							return new sources.RawSource(JSON.stringify(map));
						});
					}
				},
			);
		});
	}
}
