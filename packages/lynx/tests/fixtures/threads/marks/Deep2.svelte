<!--
	The second of three components whose root is one {#if}, each inside the one before.
-->
<script lang="ts">
	import Deep1 from "./Deep1.svelte";
	let { flag, log }: { flag: boolean; log: unknown[] } = $props();
	const shown = true;
</script>

{#if shown}
	{#if flag}<text class="deep-2" ontap={() => log.push("deep 2")}>on 2</text>{:else}<view
			class="deep-off-2"
		></view>{/if}
	<Deep1 {flag} {log} />
{/if}
