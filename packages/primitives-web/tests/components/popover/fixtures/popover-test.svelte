<!--
  The Popover.Root test popovers in one component: `variant` picks a contained trigger, a detached
  trigger or several detached triggers. Children are snippets (`popupChildren`, `portalChildren`,
  `afterTrigger`); `open` is bindable.
-->
<script lang="ts">
	import type { Snippet } from "svelte";

	import { Popover } from "#lib/components/popover/index.js";
	import type {
		PopoverPopupProps,
		PopoverPortalProps,
		PopoverPositionerProps,
		PopoverRootProps,
		PopoverTriggerProps,
	} from "#lib/components/popover/popover-types.js";

	export type TestPopoverVariant = "contained" | "detached" | "multiple";

	let {
		variant = "contained",
		open = $bindable(),
		rootProps = {},
		triggerProps = {},
		portalProps = {},
		positionerProps = {},
		popupProps = {},
		triggerPlacement = "before-content",
		triggerChildren = "Toggle",
		popupChildren,
		portalChildren,
		afterTrigger,
		includeTrigger = true,
	}: {
		variant?: TestPopoverVariant;
		open?: boolean;
		rootProps?: Partial<PopoverRootProps>;
		triggerProps?: Partial<PopoverTriggerProps>;
		portalProps?: Partial<PopoverPortalProps>;
		positionerProps?: Partial<PopoverPositionerProps>;
		popupProps?: Partial<PopoverPopupProps>;
		triggerPlacement?: "before-content" | "after-content";
		triggerChildren?: string;
		popupChildren?: Snippet;
		portalChildren?: Snippet;
		afterTrigger?: Snippet;
		includeTrigger?: boolean;
	} = $props();

	// svelte-ignore state_referenced_locally
	const handle = variant === "contained" ? undefined : Popover.createHandle();
</script>

{#snippet trigger()}
	<Popover.Trigger data-testid="trigger" {handle} {...triggerProps}
		>{triggerChildren}</Popover.Trigger
	>{@render afterTrigger?.()}{#if variant === "multiple"}<Popover.Trigger
			data-testid="trigger-2"
			{handle}>Toggle another</Popover.Trigger
		>{/if}
{/snippet}

{#snippet portal()}
	<Popover.Portal {...portalProps}>
		{@render portalChildren?.()}
		<Popover.Positioner data-testid="positioner" {...positionerProps}>
			<Popover.Popup data-testid="popover-popup" {...popupProps}>
				{#if popupChildren}{@render popupChildren()}{:else}Content{/if}
			</Popover.Popup>
		</Popover.Positioner>
	</Popover.Portal>
{/snippet}

{#if variant === "contained"}
	<Popover.Root bind:open {...rootProps}>
		{#if triggerPlacement === "before-content"}
			{#if includeTrigger}{@render trigger()}{/if}
			{@render portal()}
		{:else}
			{@render portal()}
			{#if includeTrigger}{@render trigger()}{/if}
		{/if}
	</Popover.Root>
{:else}
	{#if triggerPlacement === "before-content" && includeTrigger}{@render trigger()}{/if}
	<Popover.Root bind:open {handle} {...rootProps}>
		{@render portal()}
	</Popover.Root>
	{#if triggerPlacement === "after-content" && includeTrigger}{@render trigger()}{/if}
{/if}
