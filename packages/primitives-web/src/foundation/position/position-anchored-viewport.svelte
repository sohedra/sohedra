<!--
  The Viewport part of every anchored popup: it shows the content of the active trigger and, while
  the popup moves to another trigger, an inert copy of the previous content on its way out.
  Renders a `<div>` element. A component's own Viewport file hands over its store, the side its
  Positioner placed the popup on, its `instant` value and its attribute mapping.
-->
<script lang="ts" generics="Instant">
	import type { Side } from "@sohedra/primitives-core/foundation/position/index.js";
	import { untrack } from "svelte";

	import { Part, type PartUserProps, type StateAttributesMapping } from "../kernel/index.js";
	import type { ViewportView } from "./position-types.js";
	import { useViewport } from "./position-viewport.svelte.js";

	/** The Viewport's state; `instant` is each component's own type. */
	interface State {
		activationDirection: string | undefined;
		transitioning: boolean;
		instant: Instant;
	}

	interface Props {
		/** The viewport's view of the popup: a component passes its store. */
		popup: ViewportView;
		/** The side the enclosing Positioner placed the popup on. */
		side: Side;
		instant: Instant;
		attrs: StateAttributesMapping<State>;
		ref?: HTMLDivElement | null | undefined;
		user: PartUserProps<State>;
	}

	let { popup, side, instant, attrs, ref = $bindable(null), user }: Props = $props();

	// A part's store never changes while it is mounted.
	const viewport = useViewport(
		untrack(() => popup),
		() => ({ side }),
	);

	const state: State = $derived({
		activationDirection: viewport.activationDirection,
		transitioning: viewport.transitioning,
		instant,
	});
</script>

<!--
  The viewport's own content: the user's children in the `data-current` container, re-created per
  trigger and payload, beside an inert copy of the previous content while it transitions out.
-->
{#snippet body({ state: viewportState }: { state: State })}
	{#if viewport.transitioning}
		<div
			data-previous=""
			inert
			style={viewport.previousStyle}
			data-ending-style={viewport.showStartingStyle ? undefined : ""}
			{@attach viewport.attachPrevious}
		></div>
	{/if}
	{#key viewport.contentKey}
		<div
			data-current=""
			data-starting-style={viewport.transitioning && viewport.showStartingStyle ? "" : undefined}
			{@attach viewport.attachCurrent}
		>
			{@render user.children?.({ state: viewportState })}
		</div>
	{/key}
{/snippet}

<Part tag="div" bind:ref {state} {attrs} {body} {user} />
