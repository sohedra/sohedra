<!--
  An initially open Popover for the dismiss cases: the trigger (`reference`) and the popup
  (`floating`), which holds an `input` and, with `scrubber`, a `scrubber` whose `pointerdown` is
  prevented. The Root's `open` is bindable; `controls` adds the outside `open`/`close` buttons
  that set it, and `openOnPointerDown` an `opener` button that opens on `pointerdown`. A new
  `popupKey` re-creates the Positioner (the floating element) while open, which re-attaches the
  dismissal's document listeners. `onStore` hands the Root's store out.
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
		controls = false,
		openOnPointerDown = false,
		popupKey = 0,
		onStore,
	}: {
		open?: boolean;
		rootProps?: Partial<PopoverRootProps>;
		scrubber?: boolean;
		controls?: boolean;
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
	<Popover.Trigger data-testid="reference">reference</Popover.Trigger>
	<Popover.Portal>
		{#key popupKey}
			<Popover.Positioner>
				<Popover.Popup data-testid="floating">
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
{#if controls}
	<button data-testid="open" onclick={() => (open = true)}>open</button>
	<button data-testid="close" onclick={() => (open = false)}>close</button>
{/if}
