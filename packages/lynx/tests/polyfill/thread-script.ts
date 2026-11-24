// A thread's script for a suite's realm: what the thread has before the binding's fills run
// (realm.ts), the thread's fills from its entry (src/polyfill/), and the suite's bridge to its
// harness. Bundled with Rspack and SWC, lowered to ES2019 as the vendored modules are
// (scripts/polyfill/bundle.ts), into one classic script the shell loads first.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { rspack } from "@rsbuild/core";
import type { Rspack } from "@rsbuild/core";

import type { Thread } from "../../src/wire/index.ts";

const PACKAGE_ROOT = path.resolve(import.meta.dirname, "../..");

/** The thread's entry of the polyfill folder, and the function it exports. */
const FILLS: Record<Thread, { entry: string; fill: string }> = {
	background: { entry: "src/polyfill/background.ts", fill: "fillBackground" },
	"main-thread": { entry: "src/polyfill/main-thread.ts", fill: "fillMainThread" },
};

/** What a suite puts in the thread's script after the fills: a module and the function it runs. */
export interface Bridge {
	/** The module, from the package's root. */
	module: string;
	/** Its export the script calls, with the thread. */
	connect: string;
}

/** Bundles the thread's script for a suite, into `folder`, and returns its path. */
export async function buildThreadScript(options: {
	thread: Thread;
	bridge: Bridge;
	folder: string;
}): Promise<string> {
	const { thread, bridge, folder } = options;
	const source = (file: string): string => JSON.stringify(path.join(PACKAGE_ROOT, file));
	const work = fs.mkdtempSync(path.join(os.tmpdir(), "sohedra-thread-script-"));
	try {
		const entry = path.join(work, "entry.ts");
		fs.writeFileSync(
			entry,
			[
				`import { setUpRealm } from ${source("tests/polyfill/realm.ts")};`,
				`import { ${FILLS[thread].fill} } from ${source(FILLS[thread].entry)};`,
				`import { ${bridge.connect} } from ${source(bridge.module)};`,
				`setUpRealm(${JSON.stringify(thread)});`,
				`${FILLS[thread].fill}();`,
				`${bridge.connect}(${JSON.stringify(thread)});`,
			].join("\n"),
		);
		const name = `${thread}.js`;
		const compiler = rspack({
			mode: "production",
			context: PACKAGE_ROOT,
			entry: { [thread]: entry },
			target: ["web", "es2019"],
			devtool: false,
			output: { path: folder, filename: name, iife: true },
			optimization: { minimize: false, splitChunks: false, runtimeChunk: false },
			resolve: { extensions: [".ts", ".js"], extensionAlias: { ".js": [".ts", ".js"] } },
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
				else if (!result) reject(new Error(`Bundling the ${thread} script gave no result.`));
				else resolve(result);
			});
		});
		if (stats.hasErrors()) {
			const { errors } = stats.toJson({ all: false, errors: true });
			throw new Error(
				`Bundling the ${thread} script failed:\n${errors?.map((e) => e.message).join("\n")}`,
			);
		}
		return path.join(folder, name);
	} finally {
		fs.rmSync(work, { recursive: true, force: true });
	}
}
