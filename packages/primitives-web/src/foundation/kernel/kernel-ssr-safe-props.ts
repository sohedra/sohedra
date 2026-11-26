// DOM-property-only keys that `<svelte:element>` would render as bogus attributes on the server.
const PROPERTY_ONLY = ["defaultValue", "defaultChecked", "indeterminate", "selected"];

// Tags whose `value` attribute means something.
const VALUE_TAGS = new Set([
	"button",
	"data",
	"input",
	"li",
	"meter",
	"option",
	"output",
	"param",
	"progress",
	"select",
	"textarea",
]);

/**
 * Drops keys that are DOM properties, not attributes, from a spread onto `tag` (or onto an
 * unknown element when `tag` is undefined, as with a `render` snippet). Model props are
 * destructured by the parts already; this is the final guard.
 */
export function ssrSafeProps<P extends Record<PropertyKey, unknown>>(props: P, tag?: string): P {
	const dropValue = tag !== undefined && !VALUE_TAGS.has(tag) && "value" in props;
	if (!dropValue && !PROPERTY_ONLY.some((key) => key in props)) {
		return props;
	}
	const safe = { ...props };
	for (const key of PROPERTY_ONLY) {
		delete safe[key];
	}
	if (dropValue) {
		delete safe.value;
	}
	return safe;
}
