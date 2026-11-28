<!--
  `usePositioner` inside an open Popover.Root whose store it positions against: a fixed 20×20
  `anchor` 200px from the right and 30px from the bottom of the viewport, and a 100px wide
  `floating` element whose height drops from 100px to 10px on "Shrink". It carries the rendered
  side and alignment as `data-side` and `data-align`. Rendered only by position-lazy-flip.svelte,
  which gives it the Root.
-->
<script lang="ts">
	import {
		initialPosition,
		PositionerStore,
	} from "@sohedra/primitives-core/foundation/position/index.js";

	import { PopoverRootContext } from "#lib/components/popover/popover-context.js";
	import type { Align, Side } from "#lib/components/popover/popover-types.js";
	import type { WebTypes } from "#lib/foundation/kernel/index.js";
	import { usePositioner } from "#lib/foundation/position/position-positioner.svelte.js";

	let {
		side = "right",
		align = "start",
		lazyFlip = true,
	}: { side?: Side; align?: Align; lazyFlip?: boolean | "placement" } = $props();

	const store = PopoverRootContext.get();
	let anchor: HTMLElement | null = $state.raw(null);
	let shrunk = $state(false);
	const height = $derived(shrunk ? 10 : 100);

	// The first position only: later ones come from the positioning.
	// svelte-ignore state_referenced_locally
	const positioner = new PositionerStore<WebTypes>({
		initial: initialPosition({ side, align, rtl: false }),
	});
	const positioning = usePositioner(store, positioner, () => ({
		anchor,
		positionMethod: "fixed",
		side,
		align,
		sideOffset: 0,
		alignOffset: 0,
		collisionBoundary: "clipping-ancestors",
		collisionPadding: 5,
		sticky: false,
		arrowPadding: 5,
		disableAnchorTracking: false,
		keepMounted: false,
		collisionAvoidance: { fallbackAxisSide: "none" },
		rtl: false,
		lazyFlip,
	}));
</script>

<div
	{@attach (element) => {
		anchor = element;
	}}
	data-testid="anchor"
	style="position: fixed; right: 200px; bottom: 30px; width: 20px; height: 20px"
>
	anchor
</div>
<div
	{@attach positioning.attach}
	data-testid="floating"
	data-side={positioner.side}
	data-align={positioner.align}
	style="{positioning.style}; width: 100px; height: {height}px"
>
	floating
</div>
<button type="button" onclick={() => (shrunk = true)}>Shrink</button>
