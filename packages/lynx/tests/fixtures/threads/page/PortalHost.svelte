<!-- Portals opened and closed from an {#if} and from keyed {#each} rows, with siblings around. -->
<script lang="ts">
	import { setContext } from "svelte";

	import Layer from "./Layer.svelte";
	import Portal from "./Portal.svelte";

	let { handles, log }: { handles: Record<string, unknown>; log: unknown[] } = $props();

	setContext("theme", "dark");
	let open = $state(false);
	let rows = $state(["a", "b", "c"]);
	let opened = $state<Record<string, boolean>>({});
	handles["open"] = (value: boolean) => (open = value);
	handles["setOpened"] = (row: string, value: boolean) => (opened[row] = value);
	handles["setRows"] = (value: string[]) => (rows = value);
</script>

<view class="page">
	<text class="before">before</text>
	{#if open}
		<Portal><Layer label="if" {log} /></Portal>
	{/if}
	<text class="after">after</text>
	{#each rows as row (row)}
		<view class="row {row}">
			<text>{row}</text>
			{#if opened[row]}
				<Portal><Layer label={row} {log} /></Portal>
			{/if}
		</view>
	{/each}
</view>
<view class="tail"><text>tail</text></view>
