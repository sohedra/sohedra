<script lang="ts">
	let { show, log }: { show: boolean; log: unknown[] } = $props();
</script>

{#if show}
	<text class="later" ontap={() => log.push("later")}>later</text>
{/if}
