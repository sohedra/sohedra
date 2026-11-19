// What the generated types change in Lynx's: the tags left out, the attributes Svelte writes in
// its own way, and what the binding adds. What Lynx's elements have and Lynx's types lack carries a
// workaround tag; the binding's own (`defer`, `value`) carries none. Generating fails once Lynx's
// types declare one of them, so it is removed from here then.

/** An attribute the binding adds to one element. */
export interface AddedAttribute {
	tag: string;
	name: string;
	type: string;
	doc: string[];
}

/** An event the binding adds to one element, with the interface of its event. */
export interface AddedEvent {
	tag: string;
	name: string;
	event: string;
	doc: string[];
}

/** Elements left out: `<frame>` until it is seen drawn on a device. */
export const OMITTED_TAGS: ReadonlySet<string> = new Set(["frame"]);

/**
 * Lynx's attributes that a Svelte component does not write as Lynx's types have them: the binding's
 * own `class` and `style` replace theirs, and the rest are ReactLynx's.
 */
export const REPLACED_ATTRIBUTES: ReadonlySet<string> = new Set([
	"class",
	"className",
	"style",
	"key",
	"ref",
	"children",
]);

/** Attributes Lynx requires that the binding fills in: a `<list-item>` takes its `{#each}` key. */
export const OPTIONAL_ATTRIBUTES: readonly { tag: string; name: string }[] = [
	{ tag: "list-item", name: "item-key" },
];

export const ADDED_ATTRIBUTES: readonly AddedAttribute[] = [
	{
		tag: "overlay",
		name: "events-pass-through",
		type: "boolean",
		doc: [
			"Whether a touch outside the overlay's children reaches the page below it.",
			"",
			'@workaround overlay-events-pass-through kind=lynx-gap delete-when="@lynx-js/types declares events-pass-through on <overlay>: remove it from scripts/types/additions.ts"',
		],
	},
	{
		tag: "list",
		name: "custom-list-name",
		type: "string",
		doc: [
			"The native list that draws it: `list-container` is Lynx's list that renders rows as it asks for them, which a deferred row needs.",
			"",
			'@workaround list-custom-list-name kind=lynx-gap delete-when="@lynx-js/types declares custom-list-name on <list>: remove it from scripts/types/additions.ts"',
		],
	},
	{
		tag: "list-item",
		name: "reuse-identifier",
		type: "string",
		doc: [
			"The kind of row this is: the list reuses a row's native view only for a row of the same kind.",
			"",
			'@workaround list-item-reuse-identifier kind=lynx-gap delete-when="@lynx-js/types declares reuse-identifier on <list-item>: remove it from scripts/types/additions.ts"',
		],
	},
	{
		tag: "list-item",
		name: "defer",
		type: "boolean | { unmountRecycled?: boolean }",
		doc: [
			"Renders the row's contents only once Lynx asks for the row, unless it is in its list's first screen. With `unmountRecycled`, the contents unmount when the page lets go of the row, and render afresh when it shows again.",
		],
	},
	{
		tag: "input",
		name: "value",
		type: "string",
		doc: [
			"The text in the field, as on the web: write it back in `oninput` (`oninput={(event) => (text = event.detail.value)}`).",
		],
	},
	{
		tag: "textarea",
		name: "value",
		type: "string",
		doc: [
			"The text in the field, as on the web: write it back in `oninput` (`oninput={(event) => (text = event.detail.value)}`).",
		],
	},
];

export const ADDED_EVENTS: readonly AddedEvent[] = [];

/** What the binding says of an event Lynx's types declare, in place of their doc. */
export interface EventDoc {
	tag: string;
	name: string;
	doc: string[];
}

export const EVENT_DOCS: readonly EventDoc[] = [
	{
		tag: "overlay",
		name: "requestclose",
		doc: [
			"The overlay is asked to close: Android's Back button, or a swipe from the screen's edge on iOS. Lynx names the event `requestclose` on Android and `onRequestClose` on iOS, and this hears both.",
		],
	},
];

/** What the binding says of one field of `SystemInfo`, past Lynx's doc comment. */
export interface SystemInfoNote {
	/** A line after Lynx's description. */
	note?: string;
	/** What to use instead, after Lynx's `@deprecated`. */
	deprecated?: string;
}

/** What the binding says of `SystemInfo` (`""`) and its fields. */
export const SYSTEM_INFO_NOTES: Readonly<Record<string, SystemInfoNote>> = {
	"": { note: "What Lynx says about the device and itself." },
	lynxSdkVersion: { deprecated: "Use `engineVersion`." },
	osVersion: { note: "Not on the main thread." },
	runtimeType: {
		note: "Not on the main thread: a template that shows it, or `osVersion`, is drawn without it in the first frame.",
	},
	theme: { note: "The theme the host gave Lynx, if any." },
};
