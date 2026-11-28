import type { WithSohedraEvent } from "@sohedra/primitives-core/foundation/kernel/index.js";
import type { Snippet } from "svelte";
import type { ClassValue, HTMLAttributes } from "svelte/elements";

/** The props a `render` snippet spreads onto its element. */
export type RenderProps = HTMLAttributes<HTMLElement>;

/** What a part's `render` snippet receives. */
export interface RenderSnippetProps<State> {
	/** The props to spread onto the rendered element. */
	props: RenderProps;
	/** The part's state. */
	state: State;
	/** The part's content, if it has any. */
	children: Snippet | undefined;
}

/** A `class` value, or a function of the part's state returning one. */
export type ClassProp<State> =
	| ClassValue
	| ((state: State) => ClassValue | undefined)
	| null
	| undefined;

/** A `style` string, or a function of the part's state returning one. */
export type StyleProp<State> = string | ((state: State) => string | undefined) | null | undefined;

/**
 * Props shared by every part: the element's attributes (handlers get `preventSohedraHandler`),
 * `class`/`style` as values or functions of state, the `render` and `children` snippets, and
 * `bind:ref`, typed as the part's element (`RefElement`).
 */
export type SohedraComponentProps<
	Attributes,
	State,
	RefElement extends HTMLElement = HTMLElement,
> = Omit<WithSohedraEvent<Attributes>, "class" | "style" | "children"> & {
	/** CSS class applied to the element, or a function of the part's state returning one. */
	class?: ClassProp<State>;
	/** Style applied to the element, or a function of the part's state returning one. */
	style?: StyleProp<State>;
	/**
	 * Replaces the part's element. Spread `props` onto exactly one element; `state` is the part's
	 * state, and `children` renders the part's content (the `children` snippet, or the part's own
	 * content such as Field.Error's message): `<p {...props}>{@render children?.()}</p>`.
	 */
	render?: Snippet<[RenderSnippetProps<State>]> | undefined;
	/** The part's content, given the part's state. */
	children?: Snippet<[{ state: State }]> | undefined;
	/** The rendered element (`bind:ref`). */
	ref?: RefElement | null | undefined;
};

/** The `nativeButton` prop of a part that renders a `<button>`. */
export interface NativeButtonProps {
	/**
	 * Whether the component renders a native `<button>` element when replacing it via the
	 * `render` snippet. Set to `false` if the rendered element is not a button (e.g. `<div>`).
	 * @default true
	 */
	nativeButton?: boolean | undefined;
}

/** The `nativeButton` prop of a part that renders another element, such as a `<span>`. */
export interface NonNativeButtonProps {
	/**
	 * Whether the component renders a native `<button>` element when replacing it via the
	 * `render` snippet. Set to `true` if the rendered element is a native button.
	 * @default false
	 */
	nativeButton?: boolean | undefined;
}

/**
 * What a part's user passed, untouched: attributes, handlers, `class`, `style` and the snippets.
 * A part hands it to `Part` as `user`; a part shared by several components takes it the same way
 * from each component's own part file.
 */
export type PartUserProps<State> = {
	class?: ClassProp<State>;
	style?: StyleProp<State>;
	render?: Snippet<[RenderSnippetProps<State>]> | undefined;
	children?: Snippet<[{ state: State }]> | undefined;
	readonly [key: PropertyKey]: unknown;
};

/**
 * The options of a class-style component constructor. A generic Root or Trigger declares a
 * construct signature taking these, because svelte-check infers a component's type parameters
 * from that signature; Svelte's own `ComponentConstructorOptions` is deprecated with class
 * components.
 */
export interface ConstructorOptions<Props> {
	target: Element | Document | ShadowRoot;
	anchor?: Element;
	props?: Props;
	context?: Map<unknown, unknown>;
	hydrate?: boolean;
	intro?: boolean;
}
