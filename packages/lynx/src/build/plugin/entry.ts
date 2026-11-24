// Page entries (one for each thread), their Lynx template, and the plugins that wrap and encode
// the bundle.

import path from "node:path";

import { RuntimeWrapperWebpackPlugin } from "@lynx-js/runtime-wrapper-webpack-plugin";
import { LynxEncodePlugin } from "@lynx-js/template-webpack-plugin";
import type {
	LynxEncodePluginOptions,
	LynxTemplatePlugin as TemplatePlugin,
} from "@lynx-js/template-webpack-plugin";
import type { EnvironmentContext, Rspack, RspackChain } from "@rsbuild/core";

import { PACKAGE_NAME } from "../../wire/index.ts";
import { LAYERS, RUNTIME_FILES, loaderPath } from "./layers.ts";
import { MainThreadAssetsPlugin } from "./main-thread-assets.ts";
import { MAIN_THREAD_ENTRY_SUFFIX } from "./main-thread-script.ts";
import { NEW_PATH_COMPILER_OPTIONS, NEW_PATH_PAGE_CONFIG } from "./page-config.ts";
import type { PageConfig } from "./page-config.ts";

/** What the Lynx build engine exposes (`Symbol.for('@lynx-js/rsbuild-plugin:config')`), as far as this plugin uses it. */
export interface LynxEngineConfig {
	resolveIntermediateDir(options?: { entryName?: string }): string;
	resolveBundleFilename(options: { entryName: string; platform: string }): string;
	/** The lazy bundles' file name (with `[name]` for the template plugin to fill), when the app's bundle filename is a function. */
	resolveLazyBundleFilename?(options: { platform: string }): string | undefined;
}

/** What the entries are made from. */
export interface PageEntryOptions {
	rootPath: string;
	lynx: LynxEngineConfig;
	LynxTemplatePlugin: typeof TemplatePlugin;
	environment: EnvironmentContext;
	isDev: boolean;
	hot: boolean;
	/** The template plugin's options. */
	template: Record<string, unknown>;
	engineVersion: string;
	/** Whether the entry draws its first frame. */
	firstFrame: (entryName: string) => boolean;
}

// The engine's own chain id, so neither side adds the wrapper twice.
const RUNTIME_WRAPPER = "lynx:runtime-wrapper";

/**
 * Replace every entry with its two layered entries (main thread, background) and its Lynx
 * template. Returns the main-thread script files.
 */
export function addPageEntries(chain: RspackChain, options: PageEntryOptions): string[] {
	const { rootPath, lynx, LynxTemplatePlugin, environment, isDev, hot, template, engineVersion } =
		options;
	const intermediateRoot = lynx.resolveIntermediateDir();
	const lazyBundleFilename = lynx.resolveLazyBundleFilename?.({ platform: environment.name });
	const liveReload = isDev && environment.config.dev?.liveReload !== false;
	const mainThreadFiles: string[] = [];

	chain
		.plugin(`${PACKAGE_NAME}:first-frame-entry-context`)
		.use(FirstFrameEntryContextPlugin, [rootPath]);

	const entries = chain.entryPoints.entries() ?? {};
	chain.entryPoints.clear();
	for (const [name, entryPoint] of Object.entries(entries)) {
		// Boundary: the chain types an entry's values as `unknown`; Rsbuild writes these shapes.
		const imports = entryImports(entryPoint.values() as EntryValue[]);
		const mainThreadEntry = `${name}${MAIN_THREAD_ENTRY_SUFFIX}`;
		const mainThreadFile = path.posix.join(intermediateRoot, name, "main-thread.js");
		mainThreadFiles.push(mainThreadFile);

		chain
			.entry(mainThreadEntry)
			.add({
				layer: LAYERS["main-thread"],
				import: [
					// Also runs main-thread functions: before the page's code, which registers them.
					RUNTIME_FILES.mainThread,
					// The page again, for its first frame and its main-thread functions. The entry as
					// written: the bundler resolves it from the app's root (FirstFrameEntryContextPlugin),
					// as it does the background's copy.
					...imports.map(
						(entry) =>
							`${loaderPath("first-frame-entry")}!${RUNTIME_FILES.firstFrame}?entry=${encodeURIComponent(entry)}${options.firstFrame(name) ? "" : "&firstFrame=off"}`,
					),
				],
				filename: mainThreadFile,
			})
			.end();

		chain
			.entry(name)
			.add({
				layer: LAYERS.background,
				import: [
					// First: what the engine lacks is filled in before any other module loads.
					RUNTIME_FILES.backgroundStartUp,
					// Bare specifier on purpose: the Lynx engine aliases it to the client with the dev
					// server's ?hostname&port query attached.
					...(liveReload || hot ? ["@lynx-js/webpack-dev-transport/client"] : []),
					// Also aliased by the engine, to a version that reloads the page through DevTool when an
					// update cannot be applied.
					...(hot ? ["@rspack/core/hot/dev-server"] : []),
					...imports,
				],
				filename: path.posix.join(intermediateRoot, name, "background.js"),
			})
			.end();

		chain.plugin(`${PACKAGE_NAME}:template-${name}`).use(LynxTemplatePlugin, [
			{
				dsl: "react_nodiff",
				chunks: [mainThreadEntry, name],
				filename: lynx.resolveBundleFilename({ entryName: name, platform: environment.name }),
				intermediate: lynx.resolveIntermediateDir({ entryName: name }),
				...template,
				// The template plugin reads these to build the CSS and the page config; the same values
				// are set again after the app's, at the end (EnginePathsPlugin).
				enableCSSSelector: true,
				enableA11y: true,
				enableRemoveCSSScope: true,
				targetSdkVersion: engineVersion,
				cssPlugins: [],
				// Lazy bundles (`import()`) as custom sections, which the runtime loads with
				// lynx.fetchBundle + lynx.loadScript.
				lazyBundleFetcher: "FetchBundle",
				...(lazyBundleFilename !== undefined && { lazyBundleFilename }),
				// Boundary: the template plugin's options are checked by the engine, and `template` holds
				// the page options the app and `pluginLynxConfig` set.
				// Boundary: the template plugin's option type has no field for the lazy-bundle settings it reads.
			} as unknown as ConstructorParameters<typeof TemplatePlugin>[0],
		]);
	}
	return mainThreadFiles;
}

/**
 * Whether `issuer` is the main thread's copy of an entry: the first frame's runtime file, with the
 * entry in its query. The bundler names it with Windows' `\` there; the runtime file's path has `/`.
 */
export function issuedByFirstFrameCopy(issuer: string): boolean {
	return issuer.replace(/\\/g, "/").startsWith(RUNTIME_FILES.firstFrame);
}

/**
 * Resolves the request of the main thread's copy of an entry from the app's root, where the
 * bundler resolves an entry for the background's copy: a file, a package's name or whatever else
 * an entry may be. The copy's own module lives in this package, which is where its request would
 * resolve from otherwise.
 */
class FirstFrameEntryContextPlugin {
	readonly rootPath: string;

	constructor(rootPath: string) {
		this.rootPath = rootPath;
	}

	apply(compiler: Rspack.Compiler): void {
		const name = `${PACKAGE_NAME}:first-frame-entry-context`;
		compiler.hooks.normalModuleFactory.tap(name, (factory) => {
			factory.hooks.beforeResolve.tap(name, (data) => {
				if (issuedByFirstFrameCopy(data.contextInfo.issuer)) data.context = this.rootPath;
			});
		});
	}
}

/** A `tapable` stage after the default (0) of every other `beforeEncode` tap. */
const LAST_STAGE = 1000;

/** Adds page-config keys to the config the encoder gets (the template plugin has options for a few). */
class PageConfigPlugin {
	readonly LynxTemplatePlugin: typeof TemplatePlugin;
	readonly config: PageConfig;

	constructor(LynxTemplatePlugin: typeof TemplatePlugin, config: PageConfig) {
		this.LynxTemplatePlugin = LynxTemplatePlugin;
		this.config = config;
	}

	apply(compiler: Rspack.Compiler): void {
		const name = `${PACKAGE_NAME}:page-config`;
		compiler.hooks.thisCompilation.tap(name, (compilation) => {
			this.LynxTemplatePlugin.getLynxTemplatePluginHooks(compilation).beforeEncode.tap(
				name,
				(args) => {
					Object.assign(args.encodeData.sourceContent.config, this.config);
					return args;
				},
			);
		});
	}
}

/**
 * Sets the engine switches that pick the newer path, after every other tap of `beforeEncode`: the
 * app's `pageConfig` and what `pluginLynxConfig` lays over the template's defaults. A later
 * `stage` runs later whatever the order the plugins were added in.
 */
class EnginePathsPlugin {
	readonly LynxTemplatePlugin: typeof TemplatePlugin;

	constructor(LynxTemplatePlugin: typeof TemplatePlugin) {
		this.LynxTemplatePlugin = LynxTemplatePlugin;
	}

	apply(compiler: Rspack.Compiler): void {
		const name = `${PACKAGE_NAME}:engine-paths`;
		compiler.hooks.thisCompilation.tap(name, (compilation) => {
			this.LynxTemplatePlugin.getLynxTemplatePluginHooks(compilation).beforeEncode.tap(
				{ name, stage: LAST_STAGE },
				(args) => {
					const { compilerOptions, sourceContent } = args.encodeData;
					Object.assign(compilerOptions, NEW_PATH_COMPILER_OPTIONS);
					Object.assign(sourceContent.config, NEW_PATH_PAGE_CONFIG);
					return args;
				},
			);
		});
	}
}

/**
 * The plugins that wrap the background scripts, mark the main-thread ones and encode the bundle.
 * This package carries its own copies of the encode and runtime-wrapper plugins, because the
 * engine exposes only its template plugin to others.
 *
 * @workaround carried-engine-plugins kind=tooling delete-when="the Lynx build engine exposes its encode and runtime-wrapper plugins to DSL plugins"
 */
export function addBundlePlugins(
	chain: RspackChain,
	options: {
		mainThreadFiles: string[];
		LynxTemplatePlugin: typeof TemplatePlugin;
		engineVersion: string;
		/** `output.inlineScripts`: whether the background script goes into the bundle. */
		inlineScripts: LynxEncodePluginOptions["inlineScripts"];
		/** The page-config keys the template plugin has no option for. */
		pageConfig: PageConfig;
	},
): void {
	const { mainThreadFiles, LynxTemplatePlugin, engineVersion, inlineScripts, pageConfig } = options;
	if (Object.keys(pageConfig).length > 0)
		chain
			.plugin(`${PACKAGE_NAME}:page-config`)
			.use(PageConfigPlugin, [LynxTemplatePlugin, pageConfig]);
	chain.plugin(`${PACKAGE_NAME}:engine-paths`).use(EnginePathsPlugin, [LynxTemplatePlugin]);
	chain
		.plugin(RUNTIME_WRAPPER)
		.use(RuntimeWrapperWebpackPlugin, [
			{
				// Same renames as ReactLynx: these wrapper params are unused. And `self` and
				// `navigator` (`undefined` there), so the bundle reads the global object's, which
				// `@sohedra/lynx-polyfill` fills. `fetch` keeps its name, which the wrapper's own code
				// reads: the background's constants point the bundle's reads of `fetch` at the global
				// object's (thread-defines.ts).
				injectVars: (vars: string[]) =>
					vars.map((name) => (RENAMED_WRAPPER_PARAMETERS.includes(name) ? `__${name}` : name)),
				targetSdkVersion: engineVersion,
				// Only background scripts are wrapped (`tt.define(...)`): the wrapper leaves a script
				// MainThreadAssetsPlugin marked.
			},
		])
		.end()
		.plugin(LynxEncodePlugin.name)
		.use(LynxEncodePlugin, [{ inlineScripts }])
		.end()
		.plugin(`${PACKAGE_NAME}:main-thread-assets`)
		.use(MainThreadAssetsPlugin, [mainThreadFiles, LynxTemplatePlugin]);
}

/** The parameters of the background's wrapper that the bundle's code must not read by name. */
const RENAMED_WRAPPER_PARAMETERS = [
	"Card",
	"Component",
	"ReactLynx",
	"Behavior",
	"self",
	"navigator",
];

type EntryValue = string | string[] | { import: string | string[] };

function entryImports(values: EntryValue[]): string[] {
	const imports: string[] = [];
	for (const item of values) {
		if (typeof item === "string") imports.push(item);
		else if (Array.isArray(item)) imports.push(...item);
		else if (Array.isArray(item.import)) imports.push(...item.import);
		else imports.push(item.import);
	}
	return imports;
}
