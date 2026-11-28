<!--
  An open Popover whose popup is capped to the space it has (`max-height: var(--available-height)`)
  and scrolls. The trigger is fixed `anchorTop` pixels below the top of the viewport and the popup
  is nearly as wide as the viewport, so it only fits above or below. Its content is
  `contentHeight` pixels tall; `setContentHeight` changes that while the popover is open, and
  `setOpen` closes and opens it.
-->
<script lang="ts">
	import { Popover } from "#lib/components/popover/index.js";
	import type { PopoverPositionerProps } from "#lib/components/popover/popover-types.js";

	let {
		anchorTop,
		contentHeight: initialContentHeight,
		positionerProps = {},
	}: {
		anchorTop: number;
		contentHeight: number;
		positionerProps?: Partial<PopoverPositionerProps>;
	} = $props();

	let open = $state(true);
	// svelte-ignore state_referenced_locally
	let contentHeight = $state(initialContentHeight);

	export function setContentHeight(next: number) {
		contentHeight = next;
	}

	export function setOpen(next: boolean) {
		open = next;
	}
</script>

<Popover.Root bind:open>
	<Popover.Trigger
		data-testid="anchor"
		style="position: fixed; left: 20px; top: {anchorTop}px; width: 100px; height: 20px; padding: 0; border: 0;"
		>anchor</Popover.Trigger
	>
	<Popover.Portal>
		<Popover.Positioner data-testid="positioner" side="bottom" {...positionerProps}>
			<Popover.Popup
				data-testid="popup"
				style="box-sizing: border-box; width: calc(100vw - 40px); max-height: var(--available-height); overflow: auto;"
			>
				<div data-testid="content" style="height: {contentHeight}px"></div>
			</Popover.Popup>
		</Popover.Positioner>
	</Popover.Portal>
</Popover.Root>
