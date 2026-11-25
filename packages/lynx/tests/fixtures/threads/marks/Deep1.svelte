<!--
	The last of three components whose root is one {#if}, each inside the one before.
-->
<script lang="ts">
	let { flag, log }: { flag: boolean; log: unknown[] } = $props();
	const shown = true;
</script>

{#if shown}
	{#if flag}<text class="deep-1" ontap={() => log.push("deep 1")}>on 1</text>{:else}<view
			class="deep-off-1"
		></view>{/if}
{/if}
