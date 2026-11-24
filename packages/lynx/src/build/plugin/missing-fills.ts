// Fails the build at each read of a global that a fill of `@sohedra/lynx-polyfill` gives, when the
// thread's engine lacks it and the app imports neither that fill nor the catch-all. Whether the app
// imports a fill is known once every module is: the loaders keep each module's reads
// (checks/fills-store.ts), and the module graph says which of the package's entries the build holds.

import type { Rspack } from "@rsbuild/core";

import { PACKAGE_NAME } from "../../wire/index.ts";
import { createFillsStore } from "../checks/fills-store.ts";
import { isFilled } from "../checks/script-checks.ts";
import { describe } from "../diagnostics/messages.ts";

/** An import of the package or one of its subpaths, as written. */
const POLYFILL = /^@sohedra\/lynx-polyfill(?:\/[\w-]+)?$/;

/** Reports the reads no imported fill gives, once every module is known. */
export class MissingFillsPlugin {
	apply(compiler: Rspack.Compiler): void {
		const name = `${PACKAGE_NAME}:missing-fills`;
		const store = createFillsStore(compiler);
		compiler.hooks.thisCompilation.tap(name, (compilation) => {
			compilation.hooks.finishModules.tap(name, (modules) => {
				if (store.size === 0) return;
				const imports = new Set<string>();
				const resources: string[] = [];
				for (const module of modules) {
					// Boundary: a normal module has its request as written and its file.
					const { rawRequest, resource } = module as { rawRequest?: unknown; resource?: unknown };
					if (typeof rawRequest === "string" && POLYFILL.test(rawRequest)) imports.add(rawRequest);
					if (typeof resource === "string") resources.push(resource);
				}
				const present = new Set(resources);
				for (const [resource, fills] of store) {
					if (!present.has(resource)) continue;
					for (const imported of fills.imports) imports.add(imported);
				}
				const reported = new Set<string>();
				for (const [resource, fills] of store) {
					if (!present.has(resource)) continue;
					for (const fill of fills.pending) {
						if (isFilled(fill, imports)) continue;
						const text = describe(fill.report);
						if (reported.has(text)) continue;
						reported.add(text);
						compilation.errors.push(
							Object.assign(new compiler.webpack.WebpackError(text), { stack: "" }),
						);
					}
				}
			});
		});
	}
}
