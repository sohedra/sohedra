// Patches the text of Svelte's client `props.js` at two places, so that `bind:value` passed beside
// `{...rest}` keeps its setter where PrimJS runs the background thread. No copy of Svelte's file
// is kept in this repository.
//
// What it does. `<Inner bind:value {...rest} />` compiles to
// `Inner($$anchor, $.spread_props(() => rest, { get value() {…}, set value(v) {…} }))`. Inside
// `Inner`, Svelte's `prop()` finds the binding's setter with `get_descriptor(props, key)?.set`,
// where `props` is that `spread_props` Proxy. The patch makes `spread_props` record each Proxy it
// returns with its target in a module-level WeakMap, and `prop()`, when that lookup finds no
// setter and `props` is a recorded Proxy, find the setter the way the Proxy's own `set` trap
// does: it walks `target.props` from the last entry to the first, calls the entries that are
// functions, and takes the first accessor's `set`. Nothing else changes, and where the first
// lookup finds the setter (Node, JavaScriptCore, V8) the patch's code is never reached.
//
// Why. On PrimJS (Android, and iOS hosts that use it), a Proxy whose `getOwnPropertyDescriptor`
// trap returns an accessor comes back from `Object.getOwnPropertyDescriptor(proxy, key)` as a
// data descriptor, so the setter is lost and the child's writes stay local. Assignment through
// the Proxy's `set` trap works, which is why the patch goes around the lookup and not the write.
//
// If Svelte's text moves, the build fails and names the anchor that is gone: read Svelte's new
// `props.js`, and either update the anchors here and the contract row, or delete the workaround.
//
// @workaround spread-props-setter kind=lynx-bug delete-when="the oldest Lynx the binding builds for ships a PrimJS whose Object.getOwnPropertyDescriptor keeps a Proxy's accessor"

/** Svelte's client props code: the one file this patches. */
export const SPREAD_SETTER_FILE: RegExp =
	/[\\/]svelte[\\/]src[\\/]internal[\\/]client[\\/]reactivity[\\/]props\.js$/;

/** A line of that file the patch changes, as Svelte writes it, and what it becomes. */
export interface SpreadSetterAnchor {
	text: string;
	replacement: string;
	/** What the line is, for the message when it is gone. */
	what: string;
}

/** The two lines the patch changes: each must be in the file exactly once. */
export const SPREAD_SETTER_ANCHORS: readonly SpreadSetterAnchor[] = [
	{
		text: "return new Proxy({ props }, spread_props_handler);",
		replacement:
			"const target = { props }; return lynx_spread_record(new Proxy(target, spread_props_handler), target);",
		what: "`spread_props` returning `new Proxy({ props }, spread_props_handler)`",
	},
	{
		text: "get_descriptor(props, key)?.set ??",
		replacement: "get_descriptor(props, key)?.set ?? lynx_spread_setter(props, key) ??",
		what: "`prop()` finding a binding's setter with `get_descriptor(props, key)?.set ??`",
	},
];

// Appended to the file, so that no other line moves. `var` and function declarations: the helpers
// are there whatever order the module's own code runs in. They use what props.js imports
// (`get_descriptor`, `is_function`), which the contract row checks.
const HELPERS = `
var lynx_spread_targets = new WeakMap();
function lynx_spread_record(proxy, target) {
	lynx_spread_targets.set(proxy, target);
	return proxy;
}
function lynx_spread_setter(props, key) {
	var target = lynx_spread_targets.get(props);
	if (target === undefined) return undefined;
	var i = target.props.length;
	while (i--) {
		var p = target.props[i];
		if (is_function(p)) p = p();
		if (typeof p !== 'object' || p === null) continue;
		var desc = get_descriptor(p, key);
		if (desc && desc.set) return desc.set;
	}
}
`;

/**
 * Svelte's `props.js` with the workaround in it, or the anchor that is not in the file exactly
 * once.
 */
export function patchSpreadSetter(source: string): { code: string } | { missing: string } {
	let patched = source;
	for (const anchor of SPREAD_SETTER_ANCHORS) {
		const at = patched.indexOf(anchor.text);
		if (at === -1 || patched.indexOf(anchor.text, at + 1) !== -1) return { missing: anchor.what };
		// A function: `$` in the replacement is not a pattern here.
		patched = patched.replace(anchor.text, () => anchor.replacement);
	}
	return { code: patched + HELPERS };
}
