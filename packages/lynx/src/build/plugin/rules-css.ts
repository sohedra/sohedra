// CSS rules, split by thread.

import type { ChainIdentifier, CSSLoaderOptions, RspackChain } from "@rsbuild/core";

import { PACKAGE_NAME } from "../../wire/index.ts";
import { LAYERS, loaderPath } from "./layers.ts";

const IGNORE_CSS = `${PACKAGE_NAME}:ignore-css`;

/** css-loader's options with the CSS Modules class map only, no CSS. */
function exportOnlyLocals(options: CSSLoaderOptions): CSSLoaderOptions {
	if (!options.modules) return options;
	const modules = options.modules === true ? {} : options.modules;
	return {
		...options,
		modules: {
			...(typeof modules === "string" ? { mode: modules } : modules),
			exportOnlyLocals: true,
			// Boundary: css-loader's option is wider than Rsbuild's type of it.
		} as CSSLoaderOptions["modules"],
	};
}

/**
 * Plain CSS files (`import './app.css'`) load on both threads, and the CSS extract plugin would
 * put each copy in the template: the rule is split by layer, extracting on the background thread
 * only. The main thread keeps the class-name map of CSS Modules. Svelte `<style>` blocks are
 * unaffected: the main thread (Svelte's server) never imports them.
 *
 * Neither thread's CSS goes through lightningcss: Lynx needs no vendor prefixes.
 */
export function configureCssRules(chain: RspackChain, CHAIN_ID: ChainIdentifier): void {
	const cssRule = chain.module.rule(CHAIN_ID.RULE.CSS);
	const main = cssRule.oneOf(CHAIN_ID.ONE_OF.CSS_MAIN);
	main.uses.delete(CHAIN_ID.USE.LIGHTNINGCSS);
	if (cssRule.oneOfs.has(CHAIN_ID.ONE_OF.CSS_INLINE))
		cssRule.oneOf(CHAIN_ID.ONE_OF.CSS_INLINE).uses.delete(CHAIN_ID.USE.LIGHTNINGCSS);
	const uses = main.uses.entries() ?? {};
	const cssLoader = uses[CHAIN_ID.USE.CSS];
	// Not an Rsbuild CSS rule (Sass and Less are not set up).
	if (!cssLoader) return;
	const entries = main.entries() as Record<string, unknown>;
	const { test, dependency } = cssRule.entries() as { test: RegExp; dependency?: string };

	const mainThread = chain.module
		.rule(`${CHAIN_ID.RULE.CSS}:${LAYERS["main-thread"]}`)
		.test(test)
		.merge(entries)
		.issuerLayer(LAYERS["main-thread"]);
	if (dependency !== undefined) mainThread.merge({ dependency });
	// Loaders run bottom-up: css-loader, then ours.
	mainThread
		.use(IGNORE_CSS)
		.loader(loaderPath("ignore-css"))
		.end()
		.uses.merge(uses)
		.delete(CHAIN_ID.USE.MINI_CSS_EXTRACT)
		.delete(CHAIN_ID.USE.CSS)
		.end()
		.use(CHAIN_ID.USE.CSS)
		.after(IGNORE_CSS)
		.merge(cssLoader.entries() as object)
		.options(exportOnlyLocals(cssLoader.get("options") as CSSLoaderOptions));

	main.issuerLayer(LAYERS.background);
}

/** The arguments of cssnano's minimizer plugin, as far as this file reads them. */
interface CssMinimizerArgs {
	minimizerOptions?: { preset?: string | [string, Record<string, unknown>?] };
}

/**
 * The CSS minimizer is cssnano (Rspeedy's), which folds `.a .b, .a .c` into `.a :is(.b, .c)` when
 * the project's browserslist supports `:is()`. Lynx cannot parse `:is()` and drops the whole rule
 * ("CSS selector parse failed, ignore"), so cssnano's `convertToIs` is off; the rest of the
 * minification stays.
 *
 * @workaround no-is-selector kind=lynx-limit delete-when="Lynx parses :is() selectors"
 */
export function keepSelectorListsApart(chain: RspackChain, CHAIN_ID: ChainIdentifier): void {
	if (!chain.optimization.minimizers.has(CHAIN_ID.MINIMIZER.CSS)) return;
	chain.optimization.minimizer(CHAIN_ID.MINIMIZER.CSS).tap((args: CssMinimizerArgs[]) => {
		const [options = {}] = args;
		const minimizerOptions = options.minimizerOptions ?? {};
		const [name, own = {}] = Array.isArray(minimizerOptions.preset)
			? minimizerOptions.preset
			: [minimizerOptions.preset ?? "default"];
		return [
			{
				...options,
				minimizerOptions: {
					...minimizerOptions,
					preset: [name, { ...own, minifySelectors: { convertToIs: false } }],
				},
			},
		];
	});
}
