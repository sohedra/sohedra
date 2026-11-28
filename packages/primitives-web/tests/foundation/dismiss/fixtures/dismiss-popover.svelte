<!--
  An initially open Popover for the dismiss cases: the trigger (`anchor`) and the popup
  (`popup`), which holds an `input` and, with `scrubber`, a `scrubber` whose `pointerdown` is
  prevented. The Root's `open` is bindable; `openOnPointerDown` adds an `opener` button that opens
  it on `pointerdown`. A new `popupKey` re-creates the Positioner (the popup) while
  open, which re-attaches the dismissal's document listeners. `onStore` hands the Root's store out.
  No other fixture starts open with a field in its popup, or re-creates its Positioner on demand.
-->
<script lang="ts">
	import type { PopoverStore } from "@sohedra/primitives-core/components/popover/index.js";

	import { Popover } from "#lib/components/popover/index.js";
	import type { PopoverRootProps } from "#lib/components/popover/popover-types.js";
	import type { WebTypes } from "#lib/foundation/kernel/index.js";

	import StoreProbe from "../../focus/fixtures/focus-popover-store-probe.svelte";

	let {
		open = $bindable(true),
		rootProps = {},
		scrubber = false,
		openOnPointerDown = false,
		popupKey = 0,
		onStore,
	}: {
		open?: boolean;
		rootProps?: Partial<PopoverRootProps>;
		scrubber?: boolean;
		openOnPointerDown?: boolean;
		popupKey?: number;
		onStore?: (store: PopoverStore<unknown, WebTypes>) => void;
	} = $props();
</script>

{#if openOnPointerDown}
	<button data-testid="opener" onpointerdown={() => (open = true)}>Open</button>
{/if}
<Popover.Root bind:open {...rootProps}>
	{#if onStore}<StoreProbe {onStore} />{/if}
	<Popover.Trigger data-testid="anchor">anchor</Popover.Trigger>
	<Popover.Portal>
		{#key popupKey}
			<Popover.Positioner>
				<Popover.Popup data-testid="popup">
					<input data-testid="input" />
					{#if scrubber}
						<!-- svelte-ignore a11y_no_static_element_interactions -->
						<div data-testid="scrubber" onpointerdown={(event) => event.preventDefault()}></div>
					{/if}
				</Popover.Popup>
			</Popover.Positioner>
		{/key}
	</Popover.Portal>
</Popover.Root>
