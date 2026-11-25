<!--
	The first of three components whose root is one {#if}, each inside the one before.
-->
<script lang="ts">
	import Deep2 from "./Deep2.svelte";
	let { flag, log }: { flag: boolean; log: unknown[] } = $props();
	const shown = true;
</script>

{#if shown}
	{#if flag}<text class="deep-3" ontap={() => log.push("deep 3")}>on 3</text>{:else}<view
			class="deep-off-3"
		></view>{/if}
	<Deep2 {flag} {log} />
{/if}
