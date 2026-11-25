<!--
	Texts in an {#if} that may be empty: Svelte's server writes no text for one, and its client makes
	it.
-->
<script lang="ts">
	let { label, badge, log }: { label: string; badge: string; log: unknown[] } = $props();
	const shown = true;
</script>

<view>
	{#if shown}
		<view class="card" ontap={() => log.push("open card")}>
			<text class="title">Title</text>
			<text class="badge">{badge}</text>
		</view>
		<text class="save" ontap={() => log.push("save")}>{label}</text>
	{/if}
</view>
