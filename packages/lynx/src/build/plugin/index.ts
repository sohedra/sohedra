// `pluginSvelteLynx`: the Rsbuild plugin that builds a Svelte app for Lynx.
//
// A DSL plugin on the Lynx build engine (`pluginLynx` from `@lynx-js/rsbuild-plugin`): it works
// with the Rsbuild CLI and with rspeedy, and registers the engine itself when neither the app nor
// rspeedy did. The engine owns the bundle filename, the intermediate directory, source maps and
// debug metadata; this plugin asks it for them.
//
// Every entry becomes two layered entries plus one Lynx template:
//
//   <name>__main-thread  layer svelte:main-thread  the main thread's runtime, then the page's entry
//                                                  compiled for Svelte's server renderer (the first
//                                                  frame; the `worker` condition)
//   <name>               layer svelte:background   what the engine lacks, filled in, then the page's
//                                                  entry (Svelte and the app run here)
//   <bundle filename>    the engine's LynxTemplatePlugin (dsl react_nodiff) and the encoder
//
// Each `import()` becomes its own bundle (`lazy-bundle/<name>.<hash>.bundle`, next to the page),
// loaded with `lynx.fetchBundle`.
//
// Compile order per file:
//
//   .svelte            Svelte compiles (custom renderer) → the layer's SWC
//   *.svelte.[jt]s     SWC strips TypeScript (class fields kept) → Svelte's compileModule → the layer's SWC
//   other JS and TS    the layer's SWC (`node_modules` included, like ReactLynx)
//
// The main thread's SWC env matches ReactLynx's: Chrome 120 plus the ES2020+ transforms (PrimJS is
// ES2019). The background layer keeps the default env.

import type { LynxTemplatePlugin as TemplatePlugin } from "@lynx-js/template-webpack-plugin";
import type { RsbuildPlugin, RsbuildPluginAPI } from "@rsbuild/core";

import { PACKAGE_NAME } from "../../wire/index.ts";
import { buildError } from "../diagnostics/messages.ts";
import { environment } from "../globals.ts";
import { carryEncoder } from "./encoder.ts";
import { addBundlePlugins, addPageEntries } from "./entry.ts";
import type { LynxEngineConfig } from "./entry.ts";
import { loaderPath } from "./layers.ts";
import {
	appSetsSplitChunks,
	isLynxEnvironment,
	mainThreadScriptWhole,
} from "./main-thread-script.ts";
import { checkPluginOptions } from "./option-checks.ts";
import { entryFirstFrames, resolveOptions } from "./options.ts";
import { applyLynxConfig, resolvePageConfig } from "./page-config.ts";
import {
	configureBackgroundOnly,
	configureResolve,
	configureSingleCopies,
	ignoreUnusedSvelteServerCode,
} from "./resolve.ts";
import { configureTestResolve, configureTestRules } from "./rules-test.ts";
import { configureBuildRules, defineDebugEnvironment } from "./rules.ts";
import { SourceMapIgnoreListPlugin } from "./source-maps.ts";
import { checkSvelte } from "./svelte-check.ts";
import { readSvelteOptions } from "./svelte-options.ts";
import {
	checkTemplatePlugin,
	engineFolder,
	ownTemplateRange,
	ownTemplateVersion,
	templateVersionOf,
} from "./template-plugin.ts";

export type {
	DefineByThread,
	DefineValue,
	PageConfig,
	PageConfigValue,
	PluginSvelteLynxOptions,
} from "./options.ts";
import type { PluginSvelteLynxOptions } from "./options.ts";

// What the Lynx build engine exposes to DSL plugins.
const LYNX_CONFIG = Symbol.for("@lynx-js/rsbuild-plugin:config");
const LYNX_TEMPLATE_PLUGIN = Symbol.for("LynxTemplatePlugin");

const SWC_DEFAULTS = {
	jsc: {
		parser: { syntax: "typescript", tsx: false, decorators: true },
		transform: { useDefineForClassFields: false, optimizer: { simplify: true } },
	},
} as const;

/**
 * The Rsbuild plugin that builds a Svelte app for Lynx, on top of Lynx's own build plugins. Throws
 * when an option is unknown or has a wrong value: one error lists every mistake.
 */
export function pluginSvelteLynx(options: PluginSvelteLynxOptions = {}): RsbuildPlugin {
	checkPluginOptions(options);
	const resolved = resolveOptions(options);
	const { engineVersion, firstFrame, define, singleCopy, configFile } = resolved;
	const { template, pageConfig } = resolvePageConfig(resolved.pageConfig);

	return {
		name: PACKAGE_NAME,
		pre: ["lynx:rsbuild:plugin-api", "lynx:config"],
		async setup(api) {
			const root = api.context.rootPath;
			checkSvelte(root);
			const svelte = await readSvelteOptions(root, configFile);
			for (const warning of svelte.warnings) api.logger.warn(warning.message);
			// Settings are made once for each Lynx environment: a message is said once.
			const said = new Set<string>();
			const sayOnce = (message: string): void => {
				if (said.has(message)) return;
				said.add(message);
				api.logger.warn(message);
			};
			// What `pluginLynxConfig` sets wins, as in ReactLynx.
			const lynxConfig = api.useExposed<{ config?: Record<string, unknown> }>(
				Symbol.for("lynx.config"),
			)?.config;
			if (lynxConfig) applyLynxConfig({ template, pageConfig }, lynxConfig);

			if (api.context.callerName === "rstest") {
				// A test run has no bundle: no engine, no template, no layers. After Rstest's settings.
				// Development unless NODE_ENV says production (Rstest sets `test` and does not build in
				// development mode).
				const development = environment["NODE_ENV"] !== "production";
				api.modifyBundlerChain({
					order: "post",
					handler: (chain, { CHAIN_ID, bundler }) => {
						configureTestRules({
							chain,
							CHAIN_ID,
							define: define.background,
							development,
							compilerOptions: svelte.compilerOptions,
							preprocess: svelte.preprocess,
						});
						configureSingleCopies(chain, { rootPath: root, singleCopy });
						configureTestResolve(chain, development);
						ignoreUnusedSvelteServerCode(chain, bundler);
					},
				});
				return;
			}

			const registered = await registerLynxEngine(api);
			await carryEncoder();
			const { LynxTemplatePlugin: OwnTemplatePlugin } =
				await import("@lynx-js/template-webpack-plugin");
			let checked = false;
			api.modifyRsbuildConfig((config, { mergeRsbuildConfig }) => {
				const merged = mergeRsbuildConfig(config, {
					// Compile node_modules too (Svelte ships ES2022), as ReactLynx does. The app's own
					// `source.include` only adds files, so it joins this one.
					source: { include: [/\.(?:js|mjs|cjs|ts|mts|cts)$/] },
					// After the app's own: the main thread's script stays whole.
					tools: { rspack: mainThreadScriptWhole(sayOnce) },
				});
				// The plugin's SWC options are defaults: merged first, so the app's own `tools.swc` wins.
				// What the plugin cannot work without is set where each thread's rules are made, over the
				// app's.
				return mergeRsbuildConfig({ tools: { swc: SWC_DEFAULTS } }, merged);
			});

			// One script per thread, inlined into the template, unless the app splits (as ReactLynx
			// has it, for each environment).
			api.modifyEnvironmentConfig((config, { name, mergeEnvironmentConfig }) =>
				appSetsSplitChunks(api.getRsbuildConfig("original"), name)
					? config
					: mergeEnvironmentConfig(config, { splitChunks: false }),
			);

			api.modifyBundlerChain({
				order: "post",
				handler: (chain, { CHAIN_ID, environment, isDev, bundler }) => {
					// Other environments (a web or Node build beside the Lynx one) are not this plugin's.
					if (!isLynxEnvironment(environment.name)) return;
					const lynx = api.useExposed<LynxEngineConfig>(LYNX_CONFIG);
					const { LynxTemplatePlugin } =
						api.useExposed<{ LynxTemplatePlugin?: typeof TemplatePlugin }>(LYNX_TEMPLATE_PLUGIN) ??
						{};
					if (!lynx || !LynxTemplatePlugin) {
						throw buildError({ code: "lynx_engine_missing", details: {} });
					}
					// One copy of the template plugin needs no check; two must be versions that work together.
					if (!checked && LynxTemplatePlugin !== OwnTemplatePlugin) {
						checkEngineTemplatePlugin({ registered, root });
					}
					checked = true;

					// Hot reload follows Rsbuild's `dev.hmr` (on by default).
					const hot = isDev && environment.config.dev?.hmr !== false;
					// Which entries draw their first frame; the constant the runtime reads is on while any does.
					const entryNames = Object.keys(chain.entryPoints.entries() ?? {});
					const drawn = entryFirstFrames(firstFrame, entryNames);
					if (!(drawn instanceof Map)) {
						throw buildError({
							code: "first_frame_not_boolean",
							details: {
								entry: drawn.entry,
								given: JSON.stringify(drawn.given) ?? String(drawn.given),
							},
						});
					}
					const anyFirstFrame =
						typeof firstFrame === "function" ? [...drawn.values()].some(Boolean) : firstFrame;
					configureBuildRules({
						chain,
						CHAIN_ID,
						define: { "main-thread": define.mainThread, background: define.background },
						development: isDev,
						hot,
						firstFrame: anyFirstFrame,
						compilerOptions: svelte.compilerOptions,
						preprocess: svelte.preprocess,
					});
					defineDebugEnvironment(chain, bundler);
					chain.plugin(`${PACKAGE_NAME}:source-map-ignore-list`).use(SourceMapIgnoreListPlugin);
					configureSingleCopies(chain, { rootPath: root, singleCopy });
					configureBackgroundOnly(chain, loaderPath("background-only"));
					configureResolve(chain, isDev);
					ignoreUnusedSvelteServerCode(chain, bundler);
					const mainThreadFiles = addPageEntries(chain, {
						rootPath: root,
						lynx,
						LynxTemplatePlugin,
						environment,
						isDev,
						hot,
						template,
						engineVersion,
						firstFrame: (entry) => drawn.get(entry) ?? anyFirstFrame,
					});
					// The app's `output.inlineScripts` (rspeedy writes it into the config it hands Rsbuild);
					// inlined when it sets none, as ReactLynx and rspeedy have it.
					const { output, environments } = api.getRsbuildConfig("original");
					const inlineScripts =
						environments?.[environment.name]?.output?.inlineScripts ??
						output?.inlineScripts ??
						true;
					addBundlePlugins(chain, {
						mainThreadFiles,
						LynxTemplatePlugin,
						engineVersion,
						inlineScripts,
						pageConfig,
					});
				},
			});
		},
	};
}

/**
 * The template plugin of the engine that builds the app must be in the range this package
 * declares. Which engine builds depends on who registered it: this package, or the app (rspeedy).
 */
function checkEngineTemplatePlugin(options: { registered: boolean; root: string }): void {
	const folder = engineFolder(options);
	const engine = folder === undefined ? undefined : templateVersionOf(folder);
	if (engine === undefined) return;
	checkTemplatePlugin({ engine, own: ownTemplateVersion(), range: ownTemplateRange() });
}

/**
 * Register the Lynx build engine unless the app (rsbuild.config.ts) or rspeedy already did, as
 * pluginReactLynx does. Whether it was registered here.
 */
async function registerLynxEngine(api: RsbuildPluginAPI): Promise<boolean> {
	// Imported here, as rspeedy does: reading the plugin's options should not load the whole engine.
	const { isPluginLynxRegistered, pluginLynx } = await import("@lynx-js/rsbuild-plugin");
	const { environments } = api.getRsbuildConfig("original");
	if (isPluginLynxRegistered(api, Object.keys(environments ?? {}))) return false;
	const original = api.getRsbuildConfig("original");
	const { action } = api.context;
	for (const plugin of pluginLynx()) {
		if (typeof plugin.apply !== "function" || plugin.apply(original, { action }))
			await plugin.setup(api);
	}
	return true;
}
