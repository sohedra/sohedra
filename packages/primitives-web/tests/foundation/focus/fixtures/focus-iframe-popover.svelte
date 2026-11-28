<!--
  The tree of "iframe focus navigation": links around a non-modal popover whose Portal renders
  into `container` (the iframe's root), with two links in the popup.
-->
<script lang="ts">
	import { Popover } from "#lib/components/popover/index.js";

	let { container }: { container: HTMLElement } = $props();
</script>

<div>
	<a href="#prev">prev iframe link</a>
	<Popover.Root>
		<Popover.Trigger>Open</Popover.Trigger>
		<Popover.Portal {container}>
			<Popover.Positioner>
				<Popover.Popup>
					<div data-testid="popover">
						<a href="#one">popover link 1</a>
						<a href="#two">popover link 2</a>
					</div>
				</Popover.Popup>
			</Popover.Positioner>
		</Popover.Portal>
	</Popover.Root>
	<a href="#next">next iframe link</a>
</div>
