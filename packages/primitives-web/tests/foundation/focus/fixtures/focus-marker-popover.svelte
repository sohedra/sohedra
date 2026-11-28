<!--
  The trees for the inert marker of a non-modal Popover: `outside-nodes` and `anchor-siblings`
  keep the popup in the same parent as the rest (the Portal's container is a `div` at the end),
  `portalled` portals it to the body.
-->
<script lang="ts">
	import { Popover } from "#lib/components/popover/index.js";

	let { layout = "outside-nodes" }: { layout?: "outside-nodes" | "anchor-siblings" | "portalled" } =
		$props();

	let host = $state<HTMLElement>();

	function attachHost(node: HTMLElement) {
		host = node;
		return () => {
			host = undefined;
		};
	}
</script>

<Popover.Root>
	{#if layout === "outside-nodes"}
		<Popover.Trigger data-testid="anchor">anchor</Popover.Trigger>
		<div data-testid="outside-wrapper">
			<div data-testid="aria-live" aria-live="polite"></div>
			<button data-testid="btn-1">1</button>
			<button data-testid="btn-2">2</button>
		</div>
	{:else if layout === "anchor-siblings"}
		<div data-testid="outside-wrapper">
			<Popover.Trigger data-testid="anchor">anchor</Popover.Trigger>
			<button data-testid="btn-1">1</button>
			<button data-testid="btn-2">2</button>
			<div data-testid="nested-wrapper">
				<button data-testid="nested-btn">nested</button>
			</div>
		</div>
		<div data-testid="outside-sibling"></div>
	{:else}
		<div data-testid="anchor-wrapper">
			<Popover.Trigger data-testid="anchor">anchor</Popover.Trigger>
			<span data-testid="anchor-sibling-1"></span>
			<span data-testid="anchor-sibling-2"></span>
		</div>
	{/if}
	{#if layout !== "portalled"}<div {@attach attachHost}></div>{/if}
	<Popover.Portal container={layout === "portalled" ? undefined : host}>
		<Popover.Positioner>
			<Popover.Popup data-testid="popup">
				{#if layout === "portalled"}
					<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
					<span tabindex="0" data-testid="inside"></span>
				{/if}
			</Popover.Popup>
		</Popover.Positioner>
	</Popover.Portal>
</Popover.Root>
