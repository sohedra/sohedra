<!--
  The canonical Switch: a Switch.Root with every prop the test passes, sized so a real pointer can
  press it, and with `thumb` a Switch.Thumb (`data-testid="thumb"`). `getInputRef()` reads
  `bind:inputRef`.
-->
<script lang="ts">
	import { Switch, type SwitchRootProps } from "#lib/components/switch/index.js";

	let {
		thumb = false,
		style = "display: inline-block; width: 16px; height: 16px",
		...rootProps
	}: SwitchRootProps & { thumb?: boolean } = $props();

	let inputRef: HTMLInputElement | null = $state(null);

	export function getInputRef() {
		return inputRef;
	}
</script>

<Switch.Root {style} {...rootProps} bind:inputRef>
	{#if thumb}
		<Switch.Thumb data-testid="thumb" />
	{/if}
</Switch.Root>
