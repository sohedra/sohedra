// The element Svelte wraps a component in when it is given CSS custom properties
// (`<Child --tone="green" />`): it holds the properties, and the component is drawn inside it.

/**
 * The tags of that wrapper: `svelte-css-wrapper`, or `g` in SVG's namespace and under a custom
 * renderer. Lynx has neither, so the renderer creates it as a `<view>`. Lynx has no
 * `display: contents` either: the wrapper is a real box in the layout, unlike on the web, and a
 * child that relies on its parent's flex layout lays out inside the wrapper instead.
 */
export const CSS_PROPS_HOLDERS: ReadonlySet<string> = new Set(["g", "svelte-css-wrapper"]);
