// Style rules, split by thread.

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
 * Style sheets a script imports (`import './app.css'`, `.scss`, `.less`, `.styl`) load on both
 * threads, and the CSS extract plugin would put each copy in the template: each of Rsbuild's style
 * rules (CSS's, and Sass's, Less's and Stylus's when their plugins add them) is split by layer,
 * extracting on the background thread only. The main thread keeps the class-name map of CSS
 * Modules. Svelte `<style>` blocks are unaffected: the main thread (Svelte's server) never imports
 * them. ReactLynx splits the same rules the same way.
 *
 * No style sheet goes through lightningcss: Lynx needs no vendor prefixes.
 */
export function configureCssRules(chain: RspackChain, CHAIN_ID: ChainIdentifier): void {
	for (const name of [
		CHAIN_ID.RULE.CSS,
		CHAIN_ID.RULE.SASS,
		CHAIN_ID.RULE.LESS,
		CHAIN_ID.RULE.STYLUS,
	]) {
		if (!chain.module.rules.has(name)) continue;
		const isCss = name === CHAIN_ID.RULE.CSS;
		splitStyleRule(chain, {
			CHAIN_ID,
			name,
			main: isCss ? CHAIN_ID.ONE_OF.CSS_MAIN : name,
			inline: isCss ? CHAIN_ID.ONE_OF.CSS_INLINE : `${name}-inline`,
		});
	}
}

/** Split one style rule by layer, its `main` branch's loaders copied for the main thread. */
function splitStyleRule(
	chain: RspackChain,
	options: { CHAIN_ID: ChainIdentifier; name: string; main: string; inline: string },
): void {
	const { CHAIN_ID, name } = options;
	const rule = chain.module.rule(name);
	if (!rule.oneOfs.has(options.main)) return;
	const main = rule.oneOf(options.main);
	main.uses.delete(CHAIN_ID.USE.LIGHTNINGCSS);
	if (rule.oneOfs.has(options.inline))
		rule.oneOf(options.inline).uses.delete(CHAIN_ID.USE.LIGHTNINGCSS);
	const uses = main.uses.entries() ?? {};
	const cssLoader = uses[CHAIN_ID.USE.CSS];
	// Not a rule Rsbuild made: no css-loader to keep the class names with.
	if (!cssLoader) return;
	// Boundary: the chain gives a rule's settings as `unknown`.
	const entries = main.entries() as Record<string, unknown>;
	// Boundary: the chain gives a rule's settings as `unknown`.
	const { test, dependency } = rule.entries() as { test: RegExp; dependency?: string };

	const mainThread = chain.module
		.rule(`${name}:${LAYERS["main-thread"]}`)
		.test(test)
		.merge(entries)
		.issuerLayer(LAYERS["main-thread"]);
	if (dependency !== undefined) mainThread.merge({ dependency });
	// Loaders run bottom-up: the pre-processor, css-loader, then ours.
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
		// Boundary: the chain gives a loader's settings as `unknown`.
		.merge(cssLoader.entries() as object)
		// Boundary: the chain gives a loader's options as `unknown`.
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
