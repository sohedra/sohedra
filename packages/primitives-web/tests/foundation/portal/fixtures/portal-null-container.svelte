<!--
  A Popover whose Portal's `container` starts `null`: a `root` element rendered after mount
  becomes it. A container that appears after mount needs the fixture to render it itself, which
  no other fixture does.
-->
<script lang="ts">
	import { onMount } from "svelte";

	import { Popover } from "#lib/components/popover/index.js";

	let container = $state<HTMLElement | null>(null);
	let renderContainer = $state(false);

	onMount(() => {
		renderContainer = true;
	});

	function attachContainer(node: HTMLElement) {
		container = node;
		return () => {
			container = null;
		};
	}
</script>

{#if renderContainer}<div {@attach attachContainer} data-testid="root"></div>{/if}
<Popover.Root>
	<Popover.Trigger data-testid="reference">reference</Popover.Trigger>
	<Popover.Portal {container}>
		<Popover.Positioner>
			<Popover.Popup data-testid="floating" />
		</Popover.Positioner>
	</Popover.Portal>
</Popover.Root>
