// The element Svelte wraps a component in when it is given CSS custom properties
// (`<Child --tone="green" />`): it holds the properties, and the component is drawn inside it.

const WRAPPER = "svelte-css-wrapper";
const SVG_WRAPPER = "g";

/**
 * The tags of that wrapper: `svelte-css-wrapper`, or `g` in SVG's namespace and under a custom
 * renderer. Lynx has neither, so the renderer creates it as a `<view>`. Lynx has no
 * `display: contents` either: the wrapper is a real box in the layout, unlike on the web, and a
 * child that relies on its parent's flex layout lays out inside the wrapper instead.
 *
 * Svelte gives the renderer a tag's name only, so a `g` an app writes (through
 * `<svelte:element>`; the element types have none) becomes a `<view>` too.
 */
export const CSS_PROPS_HOLDERS: ReadonlySet<string> = new Set([SVG_WRAPPER, WRAPPER]);

/**
 * Whether `name` is one of `CSS_PROPS_HOLDERS`. Two compares, not a set's lookup: the renderer asks
 * it of every element it creates.
 */
export function isCssPropsHolder(name: string): boolean {
	return name === WRAPPER || name === SVG_WRAPPER;
}
