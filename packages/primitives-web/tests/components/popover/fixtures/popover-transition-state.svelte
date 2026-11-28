<!--
  The popup transition state tree: a kept-mounted popup with a 10s opacity transition that renders
  through a render snippet: `data-enter` while open and not starting, reporting each `{ open,
  transitionStatus }` it renders.
-->
<script lang="ts">
	import { Popover } from "#lib/components/popover/index.js";
	import type { PopoverPopupState } from "#lib/components/popover/popover-types.js";

	import PartStateRecorder from "./popover-state-recorder.svelte";

	type PopupState = Pick<PopoverPopupState, "open" | "transitionStatus">;

	let {
		onState,
		onOpenChangeComplete,
	}: {
		onState: (state: PopupState) => void;
		onOpenChangeComplete: (open: boolean) => void;
	} = $props();
</script>

<Popover.Root {onOpenChangeComplete}>
	<Popover.Trigger>Toggle</Popover.Trigger>
	<Popover.Portal keepMounted>
		<Popover.Positioner>
			<Popover.Popup class="transition-state-popup">
				{#snippet render({ props, state, children })}
					<div
						{...props}
						data-enter={(state.open && state.transitionStatus !== "starting") || undefined}
					>
						{@render children?.()}
						<PartStateRecorder
							state={{ open: state.open, transitionStatus: state.transitionStatus }}
							{onState}
						/>
					</div>
				{/snippet}
				Content
			</Popover.Popup>
		</Popover.Positioner>
	</Popover.Portal>
</Popover.Root>

<style>
	:global(.transition-state-popup) {
		opacity: 0;
		transition: opacity 10s linear;
	}
	:global(.transition-state-popup[data-enter]) {
		opacity: 1;
	}
</style>
