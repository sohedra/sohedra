<!-- A portal opened from a list row. -->
<script lang="ts">
	import { setContext } from "svelte";

	import Layer from "./Layer.svelte";
	import Portal from "./Portal.svelte";

	let { handles, log }: { handles: Record<string, unknown>; log: unknown[] } = $props();

	setContext("theme", "dark");
	let opened = $state<string | null>(null);
	handles["open"] = (row: string | null) => (opened = row);
</script>

<list class="feed" list-type="single" span-count={1} scroll-orientation="vertical">
	{#each ["a", "b", "c"] as row (row)}
		<list-item class="cell" reuse-identifier="row">
			<text>{row}</text>
			{#if opened === row}
				<Portal><Layer label={row} {log} /></Portal>
			{/if}
		</list-item>
	{/each}
</list>
<view class="tail"><text>tail</text></view>
