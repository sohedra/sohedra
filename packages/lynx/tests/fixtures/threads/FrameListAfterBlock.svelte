<!-- `FrameList.svelte` after an {#if} the background renders empty. -->
<script lang="ts">
	let { rows, log }: { rows: string[]; log: unknown[] } = $props();
	const extra = false;
</script>

{#if extra}
	<view class="extra"></view>
{/if}
<list class="list">
	{#each rows as row (row)}
		<list-item reuse-identifier="row">
			<text class="row" ontap={() => log.push(row)}>{row}</text>
		</list-item>
	{/each}
</list>
