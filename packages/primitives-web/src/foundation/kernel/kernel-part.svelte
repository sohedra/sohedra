<!--
  A part's element. A part writes its own attributes, handlers and attachments on the `<Part>` tag,
  as it would on an element: they are typed by the element its `tag` names (`tag="form"` takes
  `novalidate`, `tag="fieldset"` takes `disabled`). It hands over what its user passed as `user`.
  `Part` renders `<svelte:element this={tag}>` with everything merged, or the user's `render`
  snippet given the merged props and the part's state. The element holds the user's `children`, or the part's own
  `body` when it wraps them in markup of its own.

  One merge order for every part: the state's styling hooks, the part's own props, `bind:ref`, the
  user's props, then `after`. The user's `class` goes in front of the part's own and the user's
  `style` after it, each resolved against the state when it is a function.

  Attachments written on the tag must be stable functions from the part's script: an inline arrow
  would detach and attach again every time the props are merged.
-->
<script module lang="ts">
	import { BROWSER, DEV } from "esm-env";
	import { createAttachmentKey } from "svelte/attachments";

	// Shared by every part: none of these depends on the instance.

	// In the browser the style is applied property by property (`attachStyle`), not as an attribute
	// a change would replace whole; the server renders it as the attribute.
	const STYLE = createAttachmentKey();

	// Development only: an attachment that tells whether the render snippet spread `props`. Not
	// created in production, so production bundles drop it.
	const SPREAD_CHECK = DEV ? createAttachmentKey() : undefined;

	/** The tags that have no closing tag. */
	const VOID_TAGS = new Set(["area", "br", "col", "embed", "hr", "img", "input", "source", "wbr"]);
</script>

<script
	lang="ts"
	generics="Tag extends keyof SvelteHTMLElements & string, State extends object, RefElement extends HTMLElement = HTMLElement"
>
	import { warn } from "@sohedra/primitives-core/foundation/kernel";
	import type { Snippet } from "svelte";
	import type { HTMLAttributes, SvelteHTMLElements } from "svelte/elements";

	import { attachmentProps } from "./kernel-attachment-props.js";
	import {
		mergeClasses,
		mergePropsN,
		mergeStyles,
		type Props,
		type PropsInput,
	} from "./kernel-merged-props.js";
	import { webScheduler } from "./kernel-platform.js";
	import { attachRef } from "./kernel-ref.js";
	import { ssrSafeProps } from "./kernel-ssr-safe-props.js";
	import {
		getStateAttributesProps,
		type StateAttributesMapping,
	} from "./kernel-state-attributes.js";
	import { attachStyle } from "./kernel-style.js";
	import type { PartUserProps, RenderProps } from "./kernel-types.js";

	type OwnProps = Omit<SvelteHTMLElements[Tag], "children" | "this">;

	/** One source of `after`: the element's own props, or a function of the props merged so far. */
	type AfterInput = OwnProps | ((merged: Props) => Props) | undefined;

	type PartProps = OwnProps & {
		/** The element rendered when the user gives no `render` snippet. */
		tag: Tag;
		/** The part's public state: the `render` snippet and `children` receive it. */
		state: State;
		/** The mapping from state to styling hooks: a job's or the component's `…StateMapping`. */
		attrs?: StateAttributesMapping<State> | undefined;
		/** The user's element binding (`bind:ref`). */
		ref?: RefElement | null | undefined;
		user: PartUserProps<State>;
		/**
		 * Props that must wrap everything before them, such as button semantics: one source or
		 * several, merged in order. A function source receives the props merged so far.
		 */
		after?: AfterInput | readonly AfterInput[];
		/**
		 * The part's own content, rendered in place of the user's `children`: a part that wraps its
		 * children in markup of its own (a viewport's containers) renders them inside this snippet.
		 */
		body?: Snippet<[{ state: State }]> | undefined;
	};

	let { tag, state, attrs, ref = $bindable(null), user, after, body, ...own }: PartProps = $props();

	// What the element holds: the part's own content when it has any, else the user's children.
	const inner = $derived(body ?? user.children);

	// `bind:ref`: set when the element attaches, cleared when it detaches unless the ref has moved
	// on to another element by then.
	const refProps = attachmentProps(
		attachRef<RefElement>(
			(element) => (ref = element),
			() => ref,
		),
	);

	// Merged handlers are new functions on every derivation; that is fine, because a spread keeps
	// one listener per event and swaps the handler it calls.
	const partProps = $derived.by(() => {
		const {
			class: classProp,
			style: styleProp,
			render: _render,
			children: _children,
			...attributes
		} = user;
		const merged = mergePropsN([
			getStateAttributesProps(state, attrs),
			own,
			refProps,
			attributes,
			...(Array.isArray(after) ? (after as readonly PropsInput[]) : [after as PropsInput]),
		]);

		const className = typeof classProp === "function" ? classProp(state) : classProp;
		const style = typeof styleProp === "function" ? styleProp(state) : styleProp;
		if (className !== undefined) {
			merged.class = mergeClasses(merged.class, className);
		}
		if (style != null) {
			merged.style = mergeStyles(merged.style, style);
		}
		return merged;
	});

	// The style, applied property by property in the browser (see `STYLE`).
	const attachPartStyle = attachStyle(() => partProps.style);

	function withStyleAttachment(source: Props): Props {
		if (!BROWSER) {
			return source;
		}
		const { style: _style, ...rest } = source;
		// First among the attachments, so the others (refs, measuring wiring) see the style applied.
		return { [STYLE]: attachPartStyle, ...rest };
	}

	function withTagDefaults(source: Props): Props {
		// A button doesn't submit forms, and an image is decorative.
		if (tag === "button" && !("type" in source)) {
			return { type: "button", ...source };
		}
		if (tag === "img" && !("alt" in source)) {
			return { alt: "", ...source };
		}
		return source;
	}

	// Typed for the spread: the props are the merged HTML attributes plus attachment keys.
	const elementProps = $derived(
		withStyleAttachment(
			ssrSafeProps(withTagDefaults(partProps), tag),
		) as HTMLAttributes<HTMLElement>,
	);

	// Development only: whether the render snippet spread `props` (see `SPREAD_CHECK`).
	let spread = false;
	function checkSpread() {
		spread = true;
		return () => {
			spread = false;
		};
	}

	const renderProps = $derived(
		(DEV
			? { ...withStyleAttachment(ssrSafeProps(partProps)), [SPREAD_CHECK as symbol]: checkSpread }
			: withStyleAttachment(ssrSafeProps(partProps))) as RenderProps,
	);

	if (DEV) {
		// After a frame, warns when the render snippet's element did not take the props.
		$effect(() => {
			if (!user.render) {
				return;
			}
			return webScheduler.frame(() => {
				if (!spread) {
					warn("The render snippet must spread `props` onto an element.");
				}
			});
		});
	}
</script>

<!-- The part's content, for the render snippet to place inside its element. -->
{#snippet content()}{@render inner?.({ state })}{/snippet}

{#if user.render}
	{@render user.render({
		props: renderProps,
		state,
		children: inner ? content : undefined,
	})}
{:else if VOID_TAGS.has(tag)}
	<svelte:element this={tag} {...elementProps} />
{:else}
	<svelte:element this={tag} {...elementProps}>{@render inner?.({ state })}</svelte:element>
{/if}
