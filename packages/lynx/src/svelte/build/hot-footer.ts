// With `hmr: true`, Svelte ends a component with code written for Vite:
//
//   if (import.meta.hot) {
//     App = $.hmr(App);
//     import.meta.hot.accept((module) => { App[$.HMR].update(module.default); });
//   }
//
// The build finds it, to write it again for Rspack (see the hot-reload loader).

const FOOTER =
	/if \(import\.meta\.hot\) \{\s*(\w+) = \$\.hmr\(\1\);\s*import\.meta\.hot\.accept\(\(module\) => \{\s*(?:\$\.cleanup_styles\([^)]*\);\s*)?\1\[\$\.HMR\]\.update\(module\.default\);\s*\}\);\s*\}/;

/** Where Svelte's footer is in a component's code. */
interface HotFooter {
	/** The component's name. */
	name: string;
	start: number;
	end: number;
}

/** The footer in `code`, or `undefined` when it is not compiled with `hmr`, or Svelte changed its shape. */
export function hotFooter(code: string): HotFooter | undefined {
	const match = FOOTER.exec(code);
	if (match === null) return undefined;
	return { name: match[1]!, start: match.index, end: match.index + match[0].length };
}
