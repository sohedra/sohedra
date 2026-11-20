// `@sohedra/lynx/elements`: Lynx's elements as components see them. What each element takes, sends
// and can be asked is generated from Lynx's own types (generated/elements.d.ts); this file holds the
// binding's part: the node a component gets, the element a main-thread function gets, what every
// element takes from the binding, and the namespace the Svelte language tools read with
//
//   "svelteOptions": { "namespace": "svelteLynx" }
//
// in tsconfig.json. Without it, they read Svelte's HTML elements, where `<view>` and `<text>` are SVG.
//
// Only the node's methods and `on()` compute a type, at a call: an element's attributes are flat
// interfaces, so the editor reads them as written.

import type { MainThreadRef } from "@sohedra/lynx";
import type { Gesture } from "@sohedra/lynx/gesture";
import type { Snippet } from "svelte";

import type {
	LynxCommonAttributes,
	LynxCommonEvents,
	LynxCommonMethods,
	LynxElementEvents,
	LynxElementMethods,
	LynxElements,
	LynxMethodName,
} from "./generated/elements.js";

export type * from "./generated/elements.js";

/** The events of an element, by name. */
type EventsOf<Tag extends string> = Tag extends keyof LynxElementEvents
	? LynxElementEvents[Tag]
	: LynxCommonEvents<Tag>;

/** The UI methods of an element, by name. */
type MethodsOf<Tag extends string> = Tag extends keyof LynxElementMethods
	? LynxElementMethods[Tag]
	: LynxCommonMethods;

/** What `invoke` takes after the method's name: its parameters, required when Lynx requires one. */
type ParamsOf<Method> = Method extends { params: infer Params }
	? [params: Params]
	: Method extends { params?: infer Params }
		? [params?: Params]
		: [];

/** What a UI method resolves with. */
type ResultOf<Method> = Method extends { result: infer Result } ? Result : unknown;

/** What every event has; each kind of event adds its own fields. */
export interface LynxEvent<Target = LynxNode, CurrentTarget = Target> {
	/** The event's name, as Lynx sends it: `tap`, `touchstart`… */
	readonly type: string;
	/** When the event happened. */
	readonly timestamp: number;
	/** The element the event happened on. */
	readonly target: Target;
	/** The element whose listener runs. */
	readonly currentTarget: CurrentTarget;
	/** What Lynx sends with the event. */
	readonly detail: unknown;
}

/** A handler of an event attribute: `ontap={(event) => …}`. */
export type LynxEventHandler<Event> = ((event: Event) => unknown) | null;

/**
 * An event as a main-thread function gets it: Lynx's own, whose targets are main-thread elements,
 * and which can stop the event from going further.
 */
export type MainThreadEvent<Event> = Event & {
	/** Stops the event from reaching the elements above this one. */
	stopPropagation(): void;
	/** Stops it too from reaching this element's other handlers. */
	stopImmediatePropagation(): void;
};

/** A main-thread function on an event attribute: `main-thread:ontap={(event) => { "main thread"; … }}`. */
export type MainThreadEventHandler<Event> = ((event: MainThreadEvent<Event>) => unknown) | null;

/** What `class` takes, as Svelte's `class` does: text, or arrays and objects of classes. */
export type LynxClassValue =
	| string
	| number
	| bigint
	| boolean
	| null
	| undefined
	| LynxClassValue[]
	| { [name: string]: unknown };

/** What every element takes from the binding, past Lynx's own attributes. */
export interface LynxElementAttributes<Tag extends string = string> {
	/** The element's classes, as Svelte takes them: `class={["card", { selected }]}`. */
	class?: LynxClassValue;
	/** Inline styles, as text: `style="padding: 8px"`. */
	style?: string | null;
	/** The element's `data-*` values, which an event's `target.dataset` has. */
	[data: `data-${string}`]: unknown;
	/** An attachment, `{@attach (node) => …}`: it gets the element's node. */
	[attachment: symbol]: ((node: LynxNode<Tag>) => void | (() => void)) | false | null | undefined;
	/**
	 * The element, for main-thread code: a `mainThreadRef()`, whose `current` main-thread functions
	 * read, or a main-thread function, called with the element once it is on the page. What the
	 * function returns, if a function, runs when the element goes or the value changes, as an
	 * attachment's cleanup does. Unlike ReactLynx's, which follows React's callback refs, the
	 * function is never called again with `null`. Any other value is an error.
	 */
	"main-thread:ref"?:
		// oxlint-disable-next-line typescript/no-explicit-any -- a ref of any element type
		MainThreadRef<any> | ((element: MainThread.Element) => unknown) | null;
	/** A gesture of `@sohedra/lynx/gesture`, run on the main thread from the first frame. */
	"main-thread:gesture"?: Gesture | null;
}

/** Options of `node.animate()`, with the web's names. */
interface AnimationOptions {
	/** In milliseconds. */
	duration?: number;
	/** In milliseconds. */
	delay?: number;
	/** How many times it runs; `Infinity` runs it for good. */
	iterations?: number;
	direction?: "normal" | "reverse" | "alternate" | "alternate-reverse";
	easing?: string;
	fill?: "none" | "forwards" | "backwards" | "both";
	/** The animation's name, by which it is controlled and reported; one is made up when not given. */
	name?: string;
}

/** A running animation of an element, as the web's `Animation` has it. */
export interface LynxAnimation<Target = LynxNode> {
	/** The animation's name. */
	readonly id: string;
	readonly effect: {
		readonly target: Target;
		readonly keyframes: Record<string, string | number>[];
		readonly options: AnimationOptions;
	};
	play(): void;
	pause(): void;
	/** Stops it and takes its styles off; `finished` rejects with an `AbortError`. */
	cancel(): void;
	/** Jumps to its end; `finished` resolves. */
	finish(): void;
	/**
	 * Resolves when the animation ends by itself or through `finish()`, and rejects with an
	 * `AbortError` when it is canceled, also by the engine when the list row it runs in is released.
	 * Read it right after `animate()`: an end before it is read is not heard.
	 */
	readonly finished: Promise<void>;
}

/**
 * A Lynx element as a component gets it: from `{@attach}`, as an event's `target` and
 * `currentTarget`, and from `querySelector`. It answers the DOM's tree questions at once, and takes
 * listeners, so Svelte's `on()` works on it. The element itself lives on the main thread: a change
 * reaches it with the next update, and what it is asked (`invoke`, `getComputedStyleProperty`,
 * `querySelector`) resolves later.
 *
 * ```svelte
 * <scroll-view {@attach (node) => void (scroller = node)}>…</scroll-view>
 * <view ontap={() => scroller?.invoke("scrollTo", { offset: 0, smooth: true })}>…</view>
 * ```
 *
 * A style set with `setStyleProperty` stays when Svelte next writes the element's `style`, unless
 * that write sets the same property; setting it to `null` or `""` gives it back to `style`.
 */
export interface LynxNode<Tag extends string = string> {
	readonly tag: Tag;
	/** The `id` attribute, as Lynx reports it in an event's target: `""` when there is none. */
	readonly id: string;
	/**
	 * Lynx's unique id of the element, as of the last event that had this node as a target;
	 * `undefined` before any. A list row made again has new elements: until one of its events comes,
	 * this names the element that went.
	 */
	readonly uid: number | undefined;
	/** The element's `data-*` values, without the prefix. A new object each time it is read. */
	readonly dataset: Record<string, unknown>;
	/**
	 * Whether the node is on the page, as in the DOM: its topmost ancestor is the page's root (a
	 * layer `mount` mounted is). True for the root; false for a node that left the page.
	 */
	readonly isConnected: boolean;
	/**
	 * The element that holds this one, as in the DOM: the page's root for an outermost element of the
	 * page or of a layer. `null` for the root, for a removed node, and while Svelte builds a block.
	 */
	readonly parentElement: LynxNode | null;
	/**
	 * Whether `other` is this node or is inside it, as in the DOM. `false` for `null`, `undefined`
	 * and a node of another tree.
	 */
	contains(other: LynxNode | null | undefined): boolean;
	/**
	 * Tree order: below 0 when this node comes first, above 0 when `other` does, 0 for the same node.
	 * A node comes before the nodes inside it, and a layer `mount` mounted after what the page drew.
	 * Of two nodes in separate trees, the one on the page comes first; 0 when neither is.
	 * `nodes.sort((a, b) => a.compareOrder(b))` sorts them in tree order.
	 */
	compareOrder(other: LynxNode): number;
	/** The attribute's value as it was set; `null` for an absent one and for a handler. */
	getAttribute(name: string): unknown;
	/** The names of the attributes that have a value. */
	getAttributeNames(): string[];
	setAttribute(name: string, value: unknown): void;
	/**
	 * Listens to one of the element's events, as `on(node, …)` does; `capture` hears it before the
	 * elements inside. A `catch` before the name (`catchtap`) stops it there.
	 */
	addEventListener<Type extends keyof EventsOf<Tag> & string>(
		type: Type,
		listener: (event: EventsOf<Tag>[Type]) => unknown,
		options?: { capture?: boolean },
	): void;
	/** Listens to an event Lynx's types do not name for this element. */
	addEventListener(
		type: string,
		listener: (event: LynxEvent<LynxNode, LynxNode<Tag>>) => unknown,
		options?: { capture?: boolean },
	): void;
	removeEventListener<Type extends keyof EventsOf<Tag> & string>(
		type: Type,
		listener: (event: EventsOf<Tag>[Type]) => unknown,
		options?: { capture?: boolean },
	): void;
	removeEventListener(
		type: string,
		listener: (event: LynxEvent<LynxNode, LynxNode<Tag>>) => unknown,
		options?: { capture?: boolean },
	): void;
	/** Runs this element's own listeners of `event.type`, with no propagation. */
	dispatchEvent(event: { type: string }): boolean;
	/**
	 * Calls one of the element's UI methods (`boundingClientRect`, `scrollTo`…) and resolves with its
	 * answer, typed as Lynx's types give it. It runs once the platform has laid out the update it came
	 * with. A method Lynx's types do not know is allowed, and resolves with `unknown`. A node whose
	 * tag is not known (`querySelector`'s) has every element's methods only: narrow it to call an
	 * element's own, `(node as LynxNode<"list">).invoke("scrollToPosition", …)`.
	 */
	invoke<Method extends keyof MethodsOf<Tag> & string>(
		method: Method,
		...params: ParamsOf<MethodsOf<Tag>[Method]>
	): Promise<ResultOf<MethodsOf<Tag>[Method]>>;
	invoke<Method extends string>(
		method: Method extends LynxMethodName ? never : Method,
		params?: Record<string, unknown>,
	): Promise<unknown>;
	/** Sets one inline style, its name in kebab-case; `null` or `""` gives it back to `style`. */
	setStyleProperty(name: string, value: string | number | null): void;
	/** Sets inline styles, as `setStyleProperty` does each. */
	setStyleProperties(styles: Record<string, string | number | null>): void;
	/** The value Lynx computed for one of the element's styles. */
	getComputedStyleProperty(name: string): Promise<string>;
	/** The first element inside this one that `selector` matches, or `null`. */
	querySelector(selector: string): Promise<LynxNode | null>;
	/** Every element inside this one that `selector` matches. */
	querySelectorAll(selector: string): Promise<LynxNode[]>;
	/** Animates the element; a number is the duration in milliseconds. */
	animate(
		keyframes: Record<string, string | number>[],
		options?: number | AnimationOptions,
	): LynxAnimation<LynxNode<Tag>>;
}

/** The types of main-thread code. */
export declare namespace MainThread {
	/**
	 * An element as a main-thread function gets it: an event's `target` and `currentTarget`, a ref's
	 * `current`, what a query finds. One object stands for one element while it is on the page, so
	 * `event.target === ref.current`. Its tree questions have the background node's names.
	 */
	interface Element {
		/** The element that holds this one; `null` for the page, and once the element is gone. */
		readonly parentElement: Element | null;
		/** The element's `data-*` values, without the prefix. */
		readonly dataset: Record<string, unknown>;
		/** Whether `other` is this element or inside it. */
		contains(other: unknown): boolean;
		getAttribute(name: string): unknown;
		getAttributeNames(): string[];
		setAttribute(name: string, value: unknown): void;
		/** Sets one inline style; `null` or `""` gives the property back to `style`. */
		setStyleProperty(name: string, value: string | number | null): void;
		/** Sets inline styles, as `setStyleProperty` does each. */
		setStyleProperties(styles: Record<string, string | number | null>): void;
		getComputedStyleProperty(name: string): string;
		querySelector(selector: string): Element | null;
		querySelectorAll(selector: string): Element[];
		/** Animates the element; a number is the duration in milliseconds. Its `id` is made up. */
		animate(
			keyframes: Record<string, string | number>[],
			options?: number | Omit<AnimationOptions, "name">,
		): Animation;
		/** Calls one of the element's UI methods and resolves with its answer. */
		invoke(method: string, params?: Record<string, unknown>): Promise<unknown>;
	}

	/** An animation a main-thread function started. */
	interface Animation {
		readonly id: string;
		play(): void;
		pause(): void;
		cancel(): void;
	}
}

/** What `<svelte:options>` takes on Lynx. */
interface SvelteOptions {
	runes?: boolean;
	namespace?: "html" | "svg" | "mathml";
	/** Set by the binding's Svelte config: the module of the renderer. */
	customRenderer?: string;
	preserveWhitespace?: boolean;
}

declare global {
	/**
	 * Lynx's elements for the Svelte language tools, which read this namespace with
	 * `"svelteOptions": { "namespace": "svelteLynx" }`. It does not exist at runtime.
	 */
	namespace svelteLynx {
		/** Every element a component may write, and Svelte's own that work on Lynx. */
		interface IntrinsicElements extends LynxElements {
			"svelte:options": SvelteOptions;
			"svelte:boundary": {
				onerror?: ((error: unknown, reset: () => void) => void) | null;
				failed?: Snippet<[error: unknown, reset: () => void]> | null;
				pending?: Snippet | null;
			};
		}

		/** The node an element's attachment gets. */
		function mapElementTag<Tag extends keyof LynxElements>(tag: Tag): LynxNode<Tag>;
		// oxlint-disable-next-line typescript/no-explicit-any -- `<svelte:element>`'s tag and node are whatever it is given
		function mapElementTag(tag: any): any;

		// An element the tag names takes its attributes. A tag only known at run time, a `string` (as in
		// `<svelte:element this={tag}>`), takes the attributes every element has, as Svelte's own
		// namespace takes `HTMLAttributes<any>`; a misspelled literal tag matches neither.
		function createElement<Elements extends IntrinsicElements, Key extends keyof Elements>(
			// `undefined` and `null` for `<svelte:element>`
			element: Key | undefined | null,
			attrs: Elements[Key],
			// oxlint-disable-next-line typescript/no-explicit-any -- the language tools read no element out of it
		): any;
		function createElement<Tag extends string>(
			element: Tag & (string extends Tag ? unknown : never),
			// oxlint-disable-next-line typescript/no-explicit-any -- any element's attributes
			attrs: LynxCommonAttributes<any>,
			// oxlint-disable-next-line typescript/no-explicit-any -- the language tools read no element out of it
		): any;
		function createElement<Elements extends IntrinsicElements, Key extends keyof Elements, T>(
			element: Key | undefined | null,
			attrsEnhancers: T,
			attrs: Elements[Key] & T,
			// oxlint-disable-next-line typescript/no-explicit-any -- the language tools read no element out of it
		): any;
		function createElement<Tag extends string, T>(
			element: Tag & (string extends Tag ? unknown : never),
			attrsEnhancers: T,
			// oxlint-disable-next-line typescript/no-explicit-any -- any element's attributes
			attrs: LynxCommonAttributes<any> & T,
			// oxlint-disable-next-line typescript/no-explicit-any -- the language tools read no element out of it
		): any;
	}
}

declare module "svelte/events" {
	/**
	 * Listens to one of a Lynx element's events, and returns a function that stops. Call it in an
	 * effect or an attachment, which stops it when they end.
	 */
	export function on<Tag extends string, Type extends keyof EventsOf<Tag> & string>(
		node: LynxNode<Tag>,
		type: Type,
		handler: (event: EventsOf<Tag>[Type]) => unknown,
		options?: { capture?: boolean },
	): () => void;
	/**
	 * Listens to an event Lynx's types do not name for this element: its event is a `LynxEvent`. A
	 * caught event (`on(node, "catchtap", …)`) is one of these too, though Lynx sends the event it
	 * names.
	 */
	export function on<Tag extends string>(
		node: LynxNode<Tag>,
		type: string,
		handler: (event: LynxEvent<LynxNode, LynxNode<Tag>>) => unknown,
		options?: { capture?: boolean },
	): () => void;
}

export {};
