// The Svelte options of the app being built, read from its `svelte.config.js` as the editor reads
// it, so the build compiles as the editor checks.

import { existsSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import type {
	CompileOptions,
	ModuleCompileOptions,
	PreprocessorGroup,
} from "../../svelte/build/index.ts";
import { RENDERER_ENTRY } from "../../wire/index.ts";
import { buildError, buildWarning } from "../diagnostics/messages.ts";
import type { BuildWarning } from "../diagnostics/messages.ts";
import { lynxWarningFilter } from "../svelte-config/warning-filter.ts";

/** The files a Svelte config is looked for in, in order. */
const CONFIG_FILES = [
	"svelte.config.js",
	"svelte.config.mjs",
	"svelte.config.ts",
	"svelte.config.mts",
];

/** The Svelte options the build compiles with. */
export interface SvelteOptions {
	compilerOptions: CompileOptions;
	preprocess: PreprocessorGroup[];
	/** What the config sets that the build ignores. */
	warnings: BuildWarning[];
}

// The compiler options an app may set. An allow-list, so options added by newer Svelte builds stay
// out until they are looked at.
const APP_OPTIONS = [
	"warningFilter",
	"rootDir",
	"preserveComments",
	"preserveWhitespace",
	"discloseVersion",
	"cssHash",
];
const APP_EXPERIMENTAL_OPTIONS = ["async"];
// Of those, the ones `compileModule` (`.svelte.ts` files) takes as well.
const MODULE_OPTIONS = ["warningFilter", "rootDir"];
// What the build decides: Lynx needs these values.
const BUILD_OPTIONS = [
	"generate",
	"fragments",
	"css",
	"filename",
	"name",
	"dev",
	"runes",
	"hmr",
	"sourcemap",
	"outputFilename",
	"cssOutputFilename",
	"experimental.customRenderer",
];

const isObject = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null && !Array.isArray(value);

/** The config file of the app in `root`: the one named, or the first that exists. */
export function findSvelteConfig(root: string, configFile?: string): string | undefined {
	if (configFile !== undefined) return path.resolve(root, configFile);
	return CONFIG_FILES.map((name) => path.join(root, name)).find((file) => existsSync(file));
}

/** What `defineConfig()` itself sets, which is no reason to warn. */
const isSetByConfigHelper = (key: string, value: unknown): boolean =>
	(key === "runes" && value === true) ||
	(key === "experimental.customRenderer" && value === RENDERER_ENTRY);

/** The options of the app, and a warning for each that the build ignores. */
export function pickCompilerOptions(input: Record<string, unknown>): {
	compilerOptions: CompileOptions;
	warnings: BuildWarning[];
} {
	const warnings: BuildWarning[] = [];
	const ignore = (key: string, value: unknown): void => {
		if (isSetByConfigHelper(key, value)) return;
		warnings.push(
			buildWarning(
				BUILD_OPTIONS.includes(key)
					? { code: "svelte_config_option_owned", details: { key } }
					: { code: "svelte_config_option_unsupported", details: { key } },
			),
		);
	};
	const picked: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(input)) {
		if (key === "experimental" && isObject(value)) {
			const experimental: Record<string, unknown> = {};
			for (const [name, flag] of Object.entries(value)) {
				if (APP_EXPERIMENTAL_OPTIONS.includes(name)) experimental[name] = flag;
				else ignore(`experimental.${name}`, flag);
			}
			picked["experimental"] = experimental;
		} else if (APP_OPTIONS.includes(key)) picked[key] = value;
		else ignore(key, value);
	}
	// Boundary: the allow-list is what makes these CompileOptions.
	const compilerOptions = picked as CompileOptions;
	const appFilter = compilerOptions.warningFilter;
	compilerOptions.warningFilter = lynxWarningFilter(appFilter);
	return { compilerOptions, warnings };
}

/** The options `compileModule` takes, from the app's compiler options. */
export function moduleCompilerOptions(compilerOptions: CompileOptions): ModuleCompileOptions {
	const options: Record<string, unknown> = {};
	for (const key of MODULE_OPTIONS)
		if (key in compilerOptions) options[key] = compilerOptions[key as keyof CompileOptions];
	// Boundary: the picked keys are the module options.
	return options as ModuleCompileOptions;
}

/**
 * Read the Svelte options of the app in `root`. Without a config file, the defaults of
 * `defineConfig()`. A file that cannot be read, or does not export a config, is the build's error.
 */
export async function readSvelteOptions(root: string, configFile?: string): Promise<SvelteOptions> {
	const file = findSvelteConfig(root, configFile);
	if (file === undefined) {
		const { compilerOptions } = pickCompilerOptions({});
		return { compilerOptions, preprocess: [], warnings: [] };
	}
	let loaded: unknown;
	try {
		loaded = ((await import(pathToFileURL(file).href)) as { default?: unknown }).default;
	} catch (error) {
		throw buildError({
			code: "svelte_config_invalid",
			details: { file, reason: error instanceof Error ? error.message : String(error) },
		});
	}
	if (!isObject(loaded)) {
		throw buildError({
			code: "svelte_config_invalid",
			details: { file, reason: "it has no default export that is an object" },
		});
	}
	const { compilerOptions, warnings } = pickCompilerOptions(
		isObject(loaded["compilerOptions"]) ? loaded["compilerOptions"] : {},
	);
	const preprocess = loaded["preprocess"] === undefined ? [] : [loaded["preprocess"]].flat();
	// Boundary: a config's preprocessors are Svelte's.
	return { compilerOptions, preprocess: preprocess as PreprocessorGroup[], warnings };
}
