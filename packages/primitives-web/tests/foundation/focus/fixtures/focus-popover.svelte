<!--
  A click-opened Popover for the focus manager's cases: the trigger (`reference`) and the popup
  (`floating`). `content` picks the popup's children: a `child` button, a button carrying the
  click-trigger attribute (`nested-trigger`), or nothing; `withClose` adds a Popover.Close after
  it (a `modal` popover traps focus only with one).
  The optional outside elements: an `open-state` text, `before`/`after`/`last` buttons, a `close`
  button and `controlled-open`/`controlled-close` buttons that set the bound `open`, and a
  `reopen-on-close` button that reopens the popover in the update that closes it.
  `onStore` hands the Root's store out.
  The buttons Tab moves through carry `tabindex="0"`: WebKit's Tab skips a button without one.
  A Popover demo has none of these outside elements or the store handle.
-->
<script lang="ts">
	import type { PopoverStore } from "@sohedra/primitives-core/components/popover/index.js";
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
	<Popover.Trigger data-testid="reference" {...triggerProps}>reference</Popover.Trigger>
	<Popover.Portal {...portalProps}>
		<Popover.Positioner>
			<Popover.Popup data-testid="floating" {...popupProps}>
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
