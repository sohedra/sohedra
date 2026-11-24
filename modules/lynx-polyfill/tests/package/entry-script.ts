// An app's script that imports one of the package's entries, bundled for a thread as an app's build
// resolves it: through the package's `exports`, with the `worker` condition on the main thread (as
// Sohedra's build and Lynx's main-thread layer resolve) and without it on the background. Rspack
// with SWC, lowered to ES2019 and minified, as an app's production build.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { rspack } from "@rsbuild/core";
import type { Rspack } from "@rsbuild/core";

import type { Thread } from "../../src/fills/globals.ts";

const PACKAGE_ROOT = path.resolve(import.meta.dirname, "../..");

/** The package's name, which an app imports. */
export const PACKAGE_NAME = "@sohedra/lynx-polyfill";

/** The package's subpaths, `""` for the whole baseline, as its `exports` list them. */
export function subpaths(): string[] {
	// Boundary: JSON has no type; the manifest has this shape.
	const manifest = JSON.parse(fs.readFileSync(path.join(PACKAGE_ROOT, "package.json"), "utf8")) as {
		exports: Record<string, unknown>;
	};
	return Object.keys(manifest.exports)
		.filter((key) => key !== "./package.json")
		.map((key) => key.slice(1));
}

/** The conditions an app's build resolves with on `thread`. */
const CONDITIONS: Record<Thread, string[]> = {
	"main-thread": ["worker", "import", "module", "default"],
	background: ["import", "module", "default"],
};

/** Bundles a script that imports `PACKAGE_NAME + subpath` for `thread`, and returns its text. */
export async function bundleEntry(options: {
	subpath: string;
	thread: Thread;
	minimize: boolean;
	/** The script's code after the import, as an app's next lines. */
	after?: string;
	/** Conditions the app's build adds, such as Svelte's `browser` on the background. */
	conditions?: string[];
}): Promise<string> {
	const { subpath, thread, minimize, after = "", conditions = [] } = options;
	const work = fs.mkdtempSync(path.join(os.tmpdir(), "sohedra-entry-"));
	try {
		// The app: the package installed as a link in its node_modules, as a workspace installs it.
		const linked = path.join(work, "node_modules/@sohedra/lynx-polyfill");
		fs.mkdirSync(path.dirname(linked), { recursive: true });
		fs.symlinkSync(PACKAGE_ROOT, linked, "dir");
		fs.writeFileSync(path.join(work, "entry.js"), `import "${PACKAGE_NAME}${subpath}";\n${after}`);
		const compiler = rspack({
			mode: "production",
			context: work,
			entry: { [thread]: "./entry.js" },
			target: ["web", "es2019"],
			devtool: false,
			output: { path: path.join(work, "out"), filename: "[name].js", iife: true },
			optimization: { minimize, splitChunks: false, runtimeChunk: false },
			resolve: {
				extensions: [".ts", ".js"],
				conditionNames: [...conditions, ...CONDITIONS[thread]],
				// The app's own dependencies, such as Svelte, are the package's dev dependencies here.
				modules: ["node_modules", path.join(PACKAGE_ROOT, "node_modules")],
				symlinks: true,
			},
			module: {
				rules: [
					{
						test: /\.[cm]?[jt]s$/,
						loader: "builtin:swc-loader",
						options: {
							jsc: { target: "es2019", parser: { syntax: "typescript" } },
							isModule: "unknown",
						},
						type: "javascript/auto",
					},
				],
			},
			performance: false,
			infrastructureLogging: { level: "error" },
		});
		const stats = await new Promise<Rspack.Stats>((resolve, reject) => {
			compiler.run((error, result) => {
				compiler.close(() => {});
				if (error) reject(error);
				else if (!result) reject(new Error(`Bundling ${PACKAGE_NAME}${subpath} gave no result.`));
				else resolve(result);
			});
		});
		if (stats.hasErrors()) {
			const { errors } = stats.toJson({ all: false, errors: true });
			throw new Error(
				`Bundling ${PACKAGE_NAME}${subpath} for the ${thread} failed:\n${errors?.map((e) => e.message).join("\n")}`,
			);
		}
		return fs.readFileSync(path.join(work, "out", `${thread}.js`), "utf8");
	} finally {
		fs.rmSync(work, { recursive: true, force: true });
	}
}
