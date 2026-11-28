<!--
  A popover whose Popup renders through a `render` snippet carrying a Svelte transition:
  `transition:fly|global`, an `in:`/`out:` pair, or a `transition:` on `<svelte:element>`.
-->
<script lang="ts">
	import { fade, fly } from "svelte/transition";

	import { Popover } from "#lib/components/popover/index.js";
	import type { PopoverPopupState } from "#lib/components/popover/popover-types.js";
	import type { RenderSnippetProps } from "#lib/foundation/kernel/index.js";

	let {
		variant = "transition",
		duration = 120,
		onOpenChangeComplete,
		onoutroend,
		keepMounted = false,
	}: {
		variant?: "transition" | "in-out" | "svelte-element";
		duration?: number;
		onOpenChangeComplete?: (open: boolean) => void;
		onoutroend?: () => void;
		keepMounted?: boolean;
	} = $props();
</script>

{#snippet transitionPopup({ props, children }: RenderSnippetProps<PopoverPopupState>)}
	<div {...props} transition:fly|global={{ y: 8, duration }} {onoutroend}>
		{@render children?.()}
	</div>
{/snippet}

{#snippet inOutPopup({ props, children }: RenderSnippetProps<PopoverPopupState>)}
	<div {...props} in:fly|global={{ y: 8, duration }} out:fade|global={{ duration }} {onoutroend}>
		{@render children?.()}
	</div>
{/snippet}

{#snippet elementPopup({ props, children }: RenderSnippetProps<PopoverPopupState>)}
	<svelte:element this={"div"} {...props} transition:fly|global={{ y: 8, duration }} {onoutroend}>
		{@render children?.()}
	</svelte:element>
{/snippet}

<Popover.Root {onOpenChangeComplete}>
	<Popover.Trigger>Open</Popover.Trigger>
	<Popover.Portal {keepMounted}>
		<Popover.Positioner data-testid="positioner">
			<Popover.Popup
				data-testid="popup"
				render={variant === "in-out"
					? inOutPopup
					: variant === "svelte-element"
						? elementPopup
						: transitionPopup}
			>
				Content <button type="button">Inside</button>
			</Popover.Popup>
		</Popover.Positioner>
	</Popover.Portal>
</Popover.Root>
<button type="button">Outside</button>
