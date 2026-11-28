<!--
  A popover whose content arrives after it opens: the Popup (or a Viewport in it) holds a
  `<svelte:boundary>` that shows its `pending` snippet until `promise` resolves. The resolved
  content is a 300×200 box with the popup's only button. `focusLate` points `initialFocus` at that
  button. The demo's content is there from the start.
-->
<script lang="ts">
	import { Popover } from "#lib/components/popover/index.js";
	import type { PopoverPositionerProps } from "#lib/components/popover/popover-types.js";

	let {
		promise,
		focusLate = false,
		viewport = false,
		positioner = {},
		triggerStyle,
	}: {
		promise: Promise<string>;
		focusLate?: boolean;
		viewport?: boolean;
		positioner?: Partial<PopoverPositionerProps>;
		triggerStyle?: string;
	} = $props();

	let lateButton: HTMLButtonElement | undefined = $state();
</script>

{#snippet body()}
	<svelte:boundary>
		<div data-testid="late-content" style="width: 300px; height: 200px">
			<!-- tabindex: WebKit's Tab skips buttons otherwise. -->
			<button bind:this={lateButton} data-testid="late-button" tabindex="0">{await promise}</button>
		</div>
		{#snippet pending()}
			<p data-testid="pending" style="margin: 0">Loading</p>
		{/snippet}
	</svelte:boundary>
{/snippet}

<Popover.Root>
	<Popover.Trigger data-testid="trigger" style={triggerStyle}>Open</Popover.Trigger>
	<Popover.Portal>
		<Popover.Positioner data-testid="positioner" {...positioner}>
			<Popover.Popup
				data-testid="popup"
				initialFocus={focusLate ? () => lateButton ?? null : undefined}
			>
				{#if viewport}
					<Popover.Viewport data-testid="viewport">{@render body()}</Popover.Viewport>
				{:else}
					{@render body()}
				{/if}
			</Popover.Popup>
		</Popover.Positioner>
	</Popover.Portal>
</Popover.Root>
