<!--
  A click-opened Popover for the focus manager's cases, with `content` and `withClose` in its
  popup and buttons outside it that set the bound `open`, which the demo doesn't have. The buttons
  Tab moves through carry `tabindex="0"`: WebKit's Tab skips a button without one.
-->
<script lang="ts">
	import type { PopoverStore } from "@sohedra/primitives-core/popover";
	import { flushSync } from "svelte";

	import { Popover } from "#lib/components/popover/index.js";
	import type {
		PopoverPopupProps,
		PopoverPortalProps,
		PopoverRootProps,
		PopoverTriggerProps,
	} from "#lib/components/popover/popover-types.js";
	import type { WebTypes } from "#lib/foundation/kernel/index.js";

	import StoreProbe from "./focus-popover-store-probe.svelte";

	let {
		open = $bindable(false),
		rootProps = {},
		triggerProps = {},
		portalProps = {},
		popupProps = {},
		content = "child",
		withClose = false,
		openState = false,
		before = false,
		after = false,
		last = false,
		outsideClose = false,
		controlled = false,
		reopenOnClose = false,
		onStore,
	}: {
		open?: boolean;
		rootProps?: Partial<PopoverRootProps>;
		triggerProps?: Partial<PopoverTriggerProps>;
		portalProps?: Partial<PopoverPortalProps>;
		popupProps?: Partial<PopoverPopupProps>;
		content?: "child" | "nested-trigger" | "empty";
		withClose?: boolean;
		openState?: boolean;
		before?: boolean;
		after?: boolean;
		last?: boolean;
		outsideClose?: boolean;
		controlled?: boolean;
		reopenOnClose?: boolean;
		onStore?: (store: PopoverStore<unknown, WebTypes>) => void;
	} = $props();

	// Read only by the effect below, so not reactive.
	let reopenPending = false;

	function reopen() {
		open = true;
		flushSync();
	}

	// Reopens right after the close's update (and its effects) and before the focus return the
	// close queued: once the close's update has run, in a microtask queued ahead of that return.
	$effect(() => {
		if (!open && reopenPending) {
			reopenPending = false;
			Promise.resolve().then(reopen);
		}
	});
</script>

{#if openState}<span data-testid="open-state">{String(open)}</span>{/if}
{#if before}<button tabindex="0" data-testid="before">before</button>{/if}
<Popover.Root bind:open {...rootProps}>
	{#if onStore}<StoreProbe {onStore} />{/if}
	<Popover.Trigger data-testid="anchor" {...triggerProps}>anchor</Popover.Trigger>
	<Popover.Portal {...portalProps}>
		<Popover.Positioner>
			<Popover.Popup data-testid="popup" {...popupProps}>
				{#if content === "child"}
					<button tabindex="0" data-testid="child">child</button>
				{:else if content === "nested-trigger"}
					<button tabindex="0" data-sohedra-click-trigger="" data-testid="nested-trigger"
						>nested</button
					>
				{/if}
				{#if withClose}<Popover.Close data-testid="popup-close">x</Popover.Close>{/if}
			</Popover.Popup>
		</Popover.Positioner>
	</Popover.Portal>
</Popover.Root>
{#if outsideClose}<button data-testid="close" onclick={() => (open = false)}>close</button>{/if}
{#if controlled}
	<button data-testid="controlled-open" onclick={() => (open = true)}>open</button>
	<button data-testid="controlled-close" onclick={() => (open = false)}>close</button>
{/if}
{#if reopenOnClose}
	<button data-testid="reopen-on-close" onclick={() => (reopenPending = true)}>reopen</button>
{/if}
{#if after}<button tabindex="0" data-testid="after">after</button>{/if}
{#if last}<button tabindex="0" data-testid="last">last</button>{/if}
