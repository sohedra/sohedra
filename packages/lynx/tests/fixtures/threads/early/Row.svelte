<!--
	A row with an {#if} of its own, used in both branches of NestedRow.svelte.
-->
<script lang="ts">
	let { label, onTap }: { label: string; onTap: () => void } = $props();
</script>

<view class="row" ontap={onTap}>
	{#if label}
		<text class="label">{label}</text>
	{/if}
</view>
