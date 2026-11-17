// A component's styles, as Lynx reads them.

/**
 * Lynx parses `:where()` but never matches it, and Svelte scopes every element after the first
 * in a selector as `.title:where(.svelte-xyz)`. Unwrapping keeps the same elements matching;
 * those selectors gain the scoping class's specificity, as Svelte 4 had it.
 *
 * @workaround where-selector-unwrapping kind=lynx-limit delete-when="Lynx matches :where() selectors"
 */
export function lynxCss(css: string): string {
	return css.replace(/:where\((\.[A-Za-z0-9_-]+)\)/g, "$1");
}
