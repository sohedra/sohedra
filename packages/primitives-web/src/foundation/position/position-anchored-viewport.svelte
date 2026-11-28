<!--
  The Viewport part of every anchored popup: it shows the content of the active trigger and, while
  the popup moves to another trigger, an inert copy of the previous content on its way out.
  Renders a `<div>` element. A component's own Viewport file hands over its public name, its store,
  the side its Positioner placed the popup on and its attribute mapping. Its state is its content
  store's.
-->
<script lang="ts">
	import type { PopupView } from "@sohedra/primitives-core/foundation/popup";
	import type { AnchoredViewportState, Side } from "@sohedra/primitives-core/foundation/position";
	import { untrack } from "svelte";

	import {
		Part,
		type PartUserProps,
		type StateAttributesMapping,
		type WebTypes,
	} from "../kernel/index.js";
	import { useViewport } from "./position-viewport.svelte.js";

	type State = AnchoredViewportState;

	interface Props {
		/** The Viewport part's public name (`Popover.Viewport`), for its errors. */
		part: string;
		/** The viewport's view of the popup: a component passes its store. */
		popup: PopupView<WebTypes>;
		/** The side the enclosing Positioner placed the popup on. */
		side: Side;
		attrs: StateAttributesMapping<State>;
		ref?: HTMLDivElement | null | undefined;
		user: PartUserProps<State>;
	}

	let { part, popup, side, attrs, ref = $bindable(null), user }: Props = $props();

	// A part's store and name never change while it is mounted.
	const fixed = untrack(() => ({ popup, part }));
	const viewport = useViewport(fixed.popup, () => ({ side }), { part: fixed.part });
</script>

<!--
  The viewport's own content: the user's children in the `data-current` container, re-created per
  trigger and payload, beside an inert copy of the previous content while it transitions out.
-->
{#snippet body({ state: viewportState }: { state: State })}
	{#if viewport.state.transitioning}
		<div {...viewport.previous}></div>
	{/if}
	{#key viewport.contentKey}
		<div {...viewport.current}>
			{@render user.children?.({ state: viewportState })}
		</div>
	{/key}
{/snippet}

<Part tag="div" bind:ref state={viewport.state} {attrs} {body} {user} />
