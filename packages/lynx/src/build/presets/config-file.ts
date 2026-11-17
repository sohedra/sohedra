// Which build config file an app has, for what reads it outside a build: the test presets. One
// finder, so every reader takes the same file when an app has both.

import { existsSync } from "node:fs";
import path from "node:path";

import type { RsbuildConfig } from "@rsbuild/core";

import { workingDirectory } from "../globals.ts";

/** Where an app's root and its build config file are. */
export interface ConfigFileOptions {
	/**
	 * The app's root.
	 * @defaultValue the working directory
	 */
	rootPath?: string;
	/**
	 * The app's build config file.
	 * @defaultValue `lynx.config.*` (rspeedy), else `rsbuild.config.*`
	 */
	configPath?: string;
}

/** Who loads the file: rspeedy for `lynx.config.*`, Rsbuild for anything else. */
export type ConfigLoader = "rspeedy" | "rsbuild";

const EXTENSIONS = ["ts", "js", "mts", "mjs", "cts", "cjs"];
const NAMES = ["lynx.config", "rsbuild.config"];
const RSPEEDY_CONFIG = /(?:^|[\\/])lynx\.config\.[cm]?[jt]s$/;

/** The loader for a config file, by its name. */
export function configLoader(file: string): ConfigLoader {
	return RSPEEDY_CONFIG.test(file) ? "rspeedy" : "rsbuild";
}

/** The build config in `root`: `lynx.config.*` if there is one, else `rsbuild.config.*`. */
export function findConfigFile(root: string): string | undefined {
	for (const name of NAMES) {
		for (const extension of EXTENSIONS) {
			const candidate = path.join(root, `${name}.${extension}`);
			if (existsSync(candidate)) return candidate;
		}
	}
	return undefined;
}

/** The app's build config: `lynx.config.*` when it builds with rspeedy, `rsbuild.config.*` otherwise. */
export async function loadLynxConfig(options: ConfigFileOptions = {}): Promise<RsbuildConfig> {
	const { rootPath = workingDirectory(), configPath } = options;
	const file = configPath ?? findConfigFile(rootPath);
	if (file !== undefined && configLoader(file) === "rspeedy") {
		const { loadConfig } = await import("@lynx-js/rspeedy");
		const { content } = await loadConfig({ cwd: rootPath, configPath: file });
		// Boundary: rspeedy's config is Rsbuild's, plus its own keys.
		return content as RsbuildConfig;
	}
	const { loadConfig } = await import("@rsbuild/core");
	const { content } = await loadConfig({
		cwd: rootPath,
		...(file !== undefined && { path: file }),
	});
	return content;
}
