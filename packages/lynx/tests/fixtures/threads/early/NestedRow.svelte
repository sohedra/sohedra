<!--
	A branch picked by data only the background has, both branches the same component: what differs
	is inside the component's own {#if}.
-->
<script lang="ts">
	import Row from "./Row.svelte";

	let { user, log }: { user?: string; log: unknown[] } = $props();
</script>

<view>
	{#if user}
		<Row label="Profile" onTap={() => log.push("open profile")} />
	{:else}
		<Row label="Log in" onTap={() => log.push("log in")} />
	{/if}
</view>
