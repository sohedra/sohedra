<!--
	A touch an element and its ancestor both listen for, in a branch picked by data only the
	background has: hydration makes the branch again.
-->
<script lang="ts">
	let { user, log }: { user?: string; log: unknown[] } = $props();
</script>

<view class="outer" ontouchstart={() => log.push("outer")}>
	{#if user}
		<text class="inner" ontouchstart={() => log.push("profile")}>{user}</text>
	{:else}
		<text class="inner" ontouchstart={() => log.push("inner")}>Log in</text>
	{/if}
</view>
