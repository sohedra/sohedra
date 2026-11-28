<!--
  Popovers portalled into `container`, across Svelte block boundaries: a keyed `{#each}`, an
  `{#if}`/`{:else}` component swap, a `{#key}`, and a nested popover. Each popup shows its item.
-->
<script lang="ts">
	import { setContext } from "svelte";

	import { Popover } from "#lib/components/popover/index.js";
	import type { RenderSnippetProps } from "#lib/foundation/kernel/index.js";

	import ContextReader from "./popover-context-reader.svelte";

	let {
		container,
		items = ["a", "b", "c"],
		swap = false,
		keyValue = 0,
		nested = false,
		keepMounted = false,
		renderPortal = false,
		multiRoot = false,
		onclickInside,
		open = true,
		onOpenChange,
		sections = ["each", "swap", "key"],
	}: {
		container: HTMLElement;
		items?: string[];
		swap?: boolean;
		keyValue?: number;
		nested?: boolean;
		keepMounted?: boolean;
		renderPortal?: boolean;
		multiRoot?: boolean;
		onclickInside?: (item: string) => void;
		open?: boolean;
		onOpenChange?: (item: string, open: boolean, reason: string, event: Event) => void;
		sections?: ("each" | "swap" | "key")[];
	} = $props();

	setContext("outside", "context value");
</script>

{#snippet portalRender({ props, children }: RenderSnippetProps<unknown>)}
	<section {...props}>{@render children?.()}</section>
{/snippet}

<!-- Breaks the contract on purpose: a second root beside the element that spreads `props`. -->
{#snippet multiRootRender({ props, children }: RenderSnippetProps<unknown>)}
	<i>extra</i>
	<section {...props}>{@render children?.()}</section>
{/snippet}

{#snippet popover(item: string)}
	<Popover.Root
		{open}
		onOpenChange={(next, details) => onOpenChange?.(item, next, details.reason, details.event)}
	>
		<Popover.Trigger>Trigger {item}</Popover.Trigger>
		<Popover.Portal
			{container}
			{keepMounted}
			render={renderPortal ? (multiRoot ? multiRootRender : portalRender) : undefined}
		>
			<Popover.Positioner>
				<Popover.Popup data-testid="popup-{item}">
					<button type="button" onclick={() => onclickInside?.(item)}>Inside {item}</button>
					<ContextReader />
					{#if nested && item === "a"}
						<Popover.Root defaultOpen>
							<Popover.Trigger>Nested trigger</Popover.Trigger>
							<Popover.Portal {container}>
								<Popover.Positioner>
									<Popover.Popup data-testid="popup-nested">Nested</Popover.Popup>
								</Popover.Positioner>
							</Popover.Portal>
						</Popover.Root>
					{/if}
				</Popover.Popup>
			</Popover.Positioner>
		</Popover.Portal>
	</Popover.Root>
{/snippet}

{#if sections.includes("each")}
	<div data-testid="each">
		{#each items as item (item)}
			{@render popover(item)}
		{/each}
	</div>
{/if}

{#if sections.includes("swap")}
	<div data-testid="swap">
		{#if swap}
			{@render popover("swap-on")}
		{:else}
			{@render popover("swap-off")}
		{/if}
	</div>
{/if}

{#if sections.includes("key")}
	<div data-testid="key">
		{#key keyValue}
			{@render popover(`key-${keyValue}`)}
		{/key}
	</div>
{/if}
