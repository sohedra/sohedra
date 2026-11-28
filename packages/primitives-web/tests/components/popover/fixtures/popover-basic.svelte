<!-- A popover with every common part: trigger, portal, positioner, popup with a title, a description and a close button. -->
<script lang="ts">
	import { Popover } from "#lib/components/popover/index.js";
	import type { PopoverRootProps } from "#lib/components/popover/popover-types.js";

	let {
		rootProps = {},
		portalProps = {},
		positionerProps = {},
		popupProps = {},
		withClose = false,
		open = $bindable(),
	}: {
		rootProps?: Partial<PopoverRootProps>;
		portalProps?: Record<string, unknown>;
		positionerProps?: Record<string, unknown>;
		popupProps?: Record<string, unknown>;
		withClose?: boolean;
		open?: boolean;
	} = $props();
</script>

<Popover.Root bind:open {...rootProps}>
	<Popover.Trigger data-testid="trigger">Toggle</Popover.Trigger>
	<Popover.Portal {...portalProps}>
		<Popover.Positioner {...positionerProps}>
			<Popover.Popup data-testid="popup" {...popupProps}>
				<Popover.Title>Title</Popover.Title>
				<Popover.Description>Description</Popover.Description>
				Content
				{#if withClose}<Popover.Close>Close</Popover.Close>{/if}
			</Popover.Popup>
		</Popover.Positioner>
	</Popover.Portal>
</Popover.Root>
