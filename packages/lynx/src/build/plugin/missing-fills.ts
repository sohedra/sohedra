// Fails the build at each read of a global that a fill of `@sohedra/lynx-polyfill` gives, when the
// thread's engine lacks it and the app fills it no way: no import of that fill or of the catch-all,
// no known fill package (checks/fill-packages.ts), no assignment of its own. Whether the app fills a
// global is known once every module is: the loaders keep each module's reads (checks/fills-store.ts),
// and the module graph says which of the package's entries and which fill packages the build holds.

import type { Rspack } from "@rsbuild/core";

import { PACKAGE_NAME } from "../../wire/index.ts";
import { globalsInstalledBy } from "../checks/fill-packages.ts";
import { createFillsStore } from "../checks/fills-store.ts";
import { isFilled } from "../checks/script-checks.ts";
import { describe } from "../diagnostics/messages.ts";

/** An import of the package or one of its subpaths, as written. */
const POLYFILL = /^@sohedra\/lynx-polyfill(?:\/[\w-]+)?$/;

/** Reports the reads nothing in the app fills, once every module is known. */
export class MissingFillsPlugin {
	apply(compiler: Rspack.Compiler): void {
		const name = `${PACKAGE_NAME}:missing-fills`;
		const store = createFillsStore(compiler);
		compiler.hooks.thisCompilation.tap(name, (compilation) => {
			compilation.hooks.finishModules.tap(name, (modules) => {
				if (store.modules.size === 0) return;
				const imports = new Set<string>();
				const installs = new Set<string>();
				const present = new Set<string>();
				for (const module of modules) {
					// Boundary: a normal module has its request as written and its file.
					const { rawRequest, resource } = module as { rawRequest?: unknown; resource?: unknown };
					if (typeof rawRequest === "string" && POLYFILL.test(rawRequest)) imports.add(rawRequest);
					if (typeof resource !== "string") continue;
					present.add(resource);
					for (const global of globalsInstalledBy(resource)) installs.add(global);
				}
				for (const [resource, fills] of store.modules) {
					if (!present.has(resource)) continue;
					for (const imported of fills.imports) imports.add(imported);
					for (const installed of fills.installs) installs.add(installed);
				}
				const reported = new Set<string>();
				for (const [resource, fills] of store.modules) {
					if (!present.has(resource)) continue;
					for (const fill of fills.pending) {
						if (isFilled(fill, fill.report.details.name, { imports, installs })) continue;
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
