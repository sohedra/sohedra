// Warns when a development build's dev client lacks a file the dev-client loader changes: the
// loader warns of a function that moved inside a file, and only this sees a file that is gone.

import type { Rspack } from "@rsbuild/core";

import { PACKAGE_NAME } from "../../wire/index.ts";
import { buildWarning } from "../diagnostics/messages.ts";
import { missingDevClientFiles } from "../loaders/dev-client.ts";

/** Checks, once a compilation has its modules, that the dev client's two files were among them. */
export class DevClientCheckPlugin {
	apply(compiler: Rspack.Compiler): void {
		const name = `${PACKAGE_NAME}:dev-client-check`;
		compiler.hooks.thisCompilation.tap(name, (compilation) => {
			compilation.hooks.finishModules.tap(name, (modules) => {
				const resources: string[] = [];
				for (const module of modules) {
					// Boundary: a normal module has the file it was made from; others have none.
					const resource = (module as { resource?: unknown }).resource;
					if (typeof resource === "string") resources.push(resource);
				}
				for (const file of missingDevClientFiles(resources)) {
					const { message } = buildWarning({ code: "dev_client_moved", details: { file } });
					compilation.warnings.push(
						Object.assign(new compiler.webpack.WebpackError(message), { stack: "" }),
					);
				}
			});
		});
	}
}
