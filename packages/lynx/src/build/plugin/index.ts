// `pluginSvelteLynx`: the Rsbuild plugin that builds a Svelte app for Lynx.

import type { RsbuildPlugin } from "@rsbuild/core";

import { PACKAGE_NAME } from "../../wire/index.ts";
import { checkPluginOptions } from "./option-checks.ts";
import type { PluginSvelteLynxOptions } from "./options.ts";

export type {
	DefineByThread,
	DefineValue,
	PageConfig,
	PageConfigValue,
	PluginSvelteLynxOptions,
} from "./options.ts";

/**
 * The Rsbuild plugin that builds a Svelte app for Lynx, on top of Lynx's own build plugins.
 * Throws when an option is unknown or has a wrong value: one error lists every mistake.
 */
export function pluginSvelteLynx(options: PluginSvelteLynxOptions = {}): RsbuildPlugin {
	checkPluginOptions(options);
	return {
		name: PACKAGE_NAME,
		setup() {},
	};
}
