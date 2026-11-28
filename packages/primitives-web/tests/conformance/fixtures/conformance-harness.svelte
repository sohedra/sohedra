<!--
  The conformance suite's harness: renders the part with the props, render snippet, children and
  attachment a case asks for, inside the setup's wrapper when it has one.
-->
<script lang="ts">
	import type { Component, Snippet } from "svelte";
	import type { Attachment } from "svelte/attachments";

	import type { RenderSnippetProps } from "#lib/foundation/kernel/index.js";

	import type { ConformanceWrapperProps } from "../conformance-setup.js";

	type HarnessProps = {
		part: Component<Record<string, unknown>>;
		wrapper?: Component<ConformanceWrapperProps>;
		partProps?: Record<string, unknown>;
		/** Props added while `render` is `"button"`. */
		renderProps?: Record<string, unknown>;
		render?: "button" | "ignore-props";
		withChildren?: boolean;
		/** Reads the state the part passes to its children snippet. */
		isOn: (state: unknown) => boolean;
		attach?: Attachment;
		/** Keys of `partProps` that only the wrapper receives. */
		stateKeys?: string[];
	};

	let {
		part: Part,
		wrapper: Wrapper,
		partProps = {},
		renderProps,
		render,
		withChildren = false,
		isOn,
		attach,
		stateKeys = [],
	}: HarnessProps = $props();

	const ownProps = $derived(
		Object.fromEntries(Object.entries(partProps).filter(([key]) => !stateKeys.includes(key))),
	);

	let ref: Element | null = $state(null);
	// Toggled through `setRender`, so changing it doesn't touch the part's props (a rerender would
	// re-derive prop-backed state and hide whether the toggle itself kept it).
	let renderMode = $derived(render);

	export function getRef() {
		return ref;
	}

	export function setRender(mode: HarnessProps["render"]) {
		renderMode = mode;
	}
</script>

<!-- Annotated because a top-level snippet has no contextual type; the unannotated user pattern is
  in the Switch fixtures (switch-thumb-in-render.svelte). -->
{#snippet button({ props, state, children }: RenderSnippetProps<unknown>)}
	<button {...props} data-on={String(isOn(state))}>{@render children?.()}</button>
{/snippet}

{#snippet ignoringProps()}
	<em>ignored props</em>
{/snippet}

{#snippet stateChildren({ state }: { state: unknown })}
	<span data-testid="children">{isOn(state) ? "on" : "off"}</span>
{/snippet}

{#snippet partElement()}
	<!-- renderProps come first, so reading another prop never depends on the render mode. -->
	<Part
		{...renderMode === "button" ? renderProps : undefined}
		{...ownProps}
		bind:ref
		{@attach attach}
		render={renderMode === "button"
			? button
			: renderMode === "ignore-props"
				? ignoringProps
				: undefined}
		children={withChildren ? stateChildren : undefined}
	/>
{/snippet}

{#if Wrapper}
	<Wrapper {partProps}>{@render partElement()}</Wrapper>
{:else}
	{@render partElement()}
{/if}
