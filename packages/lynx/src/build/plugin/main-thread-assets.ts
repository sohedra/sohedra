// Marks and wraps main-thread scripts so the Lynx template encodes them as main-thread code.

import type { LynxTemplatePlugin } from "@lynx-js/template-webpack-plugin";
import type { Rspack } from "@rsbuild/core";

import { buildError } from "../diagnostics/messages.ts";
import { LAYERS } from "./layers.ts";

/**
 * The script files of lazy bundles' main-thread chunks: async chunk groups that only main-thread
 * code imports.
 */
function lazyMainThreadFiles(compilation: Rspack.Compilation): Set<string> {
	const files = new Set<string>();
	for (const group of compilation.chunkGroups) {
		if (group.isInitial()) continue;
		if (!group.origins.every((origin) => origin.module?.layer === LAYERS["main-thread"])) continue;
		for (const chunk of group.chunks) {
			if (chunk.canBeInitial()) continue;
			for (const file of chunk.files) if (file.endsWith(".js")) files.add(file);
		}
	}
	return files;
}

/**
 * Marks main-thread scripts so the template plugin encodes them as main-thread (lepus) code, and
 * gives them the banner ReactLynx gives them. A lazy bundle's main-thread chunk (`import()`) is
 * marked too, and wrapped so that running its section returns the webpack chunk. Also turns on
 * `enableEventHandleRefactor` in every page config, which the runtime's `__AddEventListener`
 * element events need, and the engine's microtask-based Promise.
 */
export class MainThreadAssetsPlugin {
	readonly files: string[];
	/** The engine's class: its hooks are the ones the engine's encoder runs. */
	readonly LynxTemplatePlugin: typeof LynxTemplatePlugin;

	constructor(files: string[], templatePlugin: typeof LynxTemplatePlugin) {
		this.files = files;
		this.LynxTemplatePlugin = templatePlugin;
	}

	apply(compiler: Rspack.Compiler): void {
		const { Compilation, sources } = compiler.webpack;
		compiler.hooks.thisCompilation.tap(MainThreadAssetsPlugin.name, (compilation) => {
			compilation.hooks.processAssets.tap(
				{ name: MainThreadAssetsPlugin.name, stage: Compilation.PROCESS_ASSETS_STAGE_ADDITIONAL },
				() => {
					for (const file of this.files) {
						const asset = compilation.getAsset(file);
						if (!asset) throw buildError({ code: "main_thread_asset_missing", details: { file } });
						compilation.updateAsset(
							file,
							(source) =>
								new sources.ConcatSource(
									"'use strict';var globDynamicComponentEntry=globDynamicComponentEntry||'__Card__';\n",
									source,
								),
							{ ...asset.info, "lynx:main-thread": true },
						);
					}
					for (const file of lazyMainThreadFiles(compilation)) {
						const asset = compilation.getAsset(file);
						if (asset)
							compilation.updateAsset(file, asset.source, {
								...asset.info,
								"lynx:main-thread": true,
							});
					}
				},
			);
			compilation.hooks.processAssets.tap(
				{
					name: MainThreadAssetsPlugin.name,
					// After the minimizer (which would drop a function expression nobody calls, leaving an
					// empty section) and before source maps are finalized.
					stage: Compilation.PROCESS_ASSETS_STAGE_OPTIMIZE_SIZE + 1,
				},
				() => {
					for (const file of lazyMainThreadFiles(compilation)) {
						const asset = compilation.getAsset(file);
						// Hot updates are applied as they are.
						if (!asset || asset.info.hotModuleReplacement) continue;
						compilation.updateAsset(
							file,
							(source) =>
								new sources.ConcatSource(
									"(function (globDynamicComponentEntry) {\n",
									"const module = { exports: {} };\n",
									"const exports = module.exports;\n",
									source,
									"\n;return module.exports;\n})",
								),
						);
					}
				},
			);
			this.LynxTemplatePlugin.getLynxTemplatePluginHooks(compilation).beforeEncode.tap(
				MainThreadAssetsPlugin.name,
				(args) => {
					args.encodeData.sourceContent.config.enableEventHandleRefactor = true;
					// The background Promise ticks on setTimeout unless the engine builds it on
					// lynx.queueMicrotask (a real microtask).
					args.encodeData.sourceContent.config.enableMicrotaskPromisePolyfill = true;
					return args;
				},
			);
		});
	}
}
