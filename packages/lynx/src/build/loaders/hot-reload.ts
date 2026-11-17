// Svelte's hot reload, for Rspack and Lynx.
//
// With `hmr: true` Svelte ends a component with code written for Vite (see `hotFooter`). Vite
// calls its callback with the new module. Rspack does not: it runs the changed module again and
// passes state from the old run to the new one in `hot.data`. So the first run's wrapper is kept
// there, and every later run hands it the new version (the same update Svelte's own footer does).
// The modules that imported the component keep the first wrapper, as with Vite.
//
// Two things cannot be swapped in place and reload the page instead:
//
// - a component's styles: they are compiled into the page's bundle, so the running page would
//   keep the old ones;
// - main-thread functions: they live in the main thread's script (`DECLINE`).

import { hotFooter } from "../../svelte/build/index.ts";
import { stringLiteral } from "../string-literal.ts";

/** The key in `hot.data` under which the first run's wrapper is kept. */
const DATA_KEY = "svelteLynxComponent";
/** The key in `hot.data` for the previous run's styles. */
const STYLES_KEY = "svelteLynxStyles";
const RELOAD = "__svelteLynxReloadPage";

/** What the footer is written from. */
export interface HotFooterOptions {
	/** The component compiled with `hmr: true`. */
	code: string;
	/** The component's compiled styles: a later version with different styles reloads the page. */
	styles: string;
	/** The module that reloads the page, as the dev client does. */
	reloadModule: string;
}

/**
 * The component's code with its footer written for Rspack, or `undefined` when the footer is not
 * there (the component was not compiled with `hmr`, or Svelte changed its shape: the caller says
 * so). Only the end of the module changes, so Svelte's source map still points into it.
 */
export function rewriteHotFooter({
	code,
	styles,
	reloadModule,
}: HotFooterOptions): string | undefined {
	const footer = hotFooter(code);
	if (footer === undefined) return undefined;
	const { name } = footer;
	const rewritten = [
		"if (import.meta.webpackHot) {",
		`\t${name} = $.hmr(${name});`,
		"",
		"\tconst __hot = import.meta.webpackHot;",
		`\tconst __first = __hot.data && __hot.data.${DATA_KEY};`,
		`\tconst __styles = ${stringLiteral(styles)};`,
		"",
		`\tif (__first && __hot.data.${STYLES_KEY} !== __styles) ${RELOAD}();`,
		`\telse if (__first) __first[$.HMR].update(${name});`,
		"\t__hot.dispose((data) => {",
		`\t\tdata.${DATA_KEY} = __first || ${name};`,
		`\t\tdata.${STYLES_KEY} = __styles;`,
		"\t});",
		"\t__hot.accept();",
		"}",
	].join("\n");
	// An import is hoisted wherever it is written: at the end, no line of the module moves.
	const reload = `\nimport { reloadPage as ${RELOAD} } from ${stringLiteral(reloadModule)};\n`;
	return code.slice(0, footer.start) + rewritten + code.slice(footer.end) + reload;
}

/**
 * Appended to a module that cannot be updated in place (it has main-thread functions, which live
 * in the main thread's script): a change to it makes the update fail, and the dev client then
 * reloads the page.
 */
export const DECLINE = "\nif (import.meta.webpackHot) import.meta.webpackHot.decline();\n";
