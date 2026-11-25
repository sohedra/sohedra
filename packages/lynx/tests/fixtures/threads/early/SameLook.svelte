<!--
	Two branches that look the same, picked by data only the background has.
-->
<script lang="ts">
	let { owner, log }: { owner?: boolean; log: unknown[] } = $props();
</script>

<view>
	{#if owner}
		<text class="cta" ontap={() => log.push("edit")}>Open</text>
	{:else}
		<text class="cta" ontap={() => log.push("view")}>Open</text>
	{/if}
</view>
