<!--
  The Popover.Positioner test trees: an open popover with a `<div>` trigger
  (`nativeButton={false}`). `scroller` wraps it in a scrolling ancestor, `dir` in a `<div dir>`,
  and `rtl` sets the internal DirectionContext. `arrowStyle` adds a Popover.Arrow.
-->
<script lang="ts">
	import { Popover } from "#lib/components/popover/index.js";
	import type { PopoverPositionerProps } from "#lib/components/popover/popover-types.js";
	import { DirectionContext } from "#lib/foundation/kernel/index.js";
	import { DirectionState } from "#lib/foundation/kernel/kernel-direction.js";

	let {
		triggerStyle = "",
		keepMounted = false,
		positionerProps = {},
		popupStyle = "",
		arrowStyle,
		scroller = false,
		dir,
		rtl = false,
	}: {
		triggerStyle?: string;
		keepMounted?: boolean;
		positionerProps?: Partial<PopoverPositionerProps>;
		popupStyle?: string;
		arrowStyle?: string;
		scroller?: boolean;
		dir?: "ltr" | "rtl";
		rtl?: boolean;
	} = $props();

	// svelte-ignore state_referenced_locally
	if (rtl) {
		DirectionContext.set(new DirectionState(() => "rtl"));
	}
</script>

{#snippet popover()}
	<Popover.Root open>
		<Popover.Trigger data-testid="trigger" nativeButton={false} style={triggerStyle}>
			Trigger
			{#snippet render({ props, children })}
				<div {...props}>{@render children?.()}</div>
			{/snippet}
		</Popover.Trigger>
		<Popover.Portal {keepMounted}>
			<Popover.Positioner data-testid="positioner" {...positionerProps}>
				<Popover.Popup style={popupStyle}>
					{#if arrowStyle !== undefined}<Popover.Arrow style={arrowStyle} />{/if}
					Popup
				</Popover.Popup>
			</Popover.Positioner>
		</Popover.Portal>
	</Popover.Root>
{/snippet}

{#if scroller}
	<div data-testid="scroller" style="height: 72px; overflow: auto">
		<div style="height: 200px">{@render popover()}</div>
	</div>
{:else if dir}
	<div {dir}>{@render popover()}</div>
{:else}
	{@render popover()}
{/if}
