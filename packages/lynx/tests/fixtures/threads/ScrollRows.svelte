<script lang="ts">
	import { tick } from "svelte";

	type Node = { invoke(method: string, params?: Record<string, unknown>): Promise<unknown> };
	let { handles }: { handles: Record<string, unknown> } = $props();
	let rows = $state(Array.from({ length: 10 }, (_, index) => index));
	let scroller: Node | undefined;
	handles["grow"] = async (waitTick: boolean) => {
		rows = [...rows, ...Array.from({ length: 20 }, (_, index) => rows.length + index)];
		if (waitTick) await tick();
		return scroller!.invoke("scrollTo", { offset: rows.length * 40 - 160, smooth: false });
	};
</script>

<scroll-view
	class="scroller"
	scroll-y
	{@attach (node) => {
		scroller = node as Node;
	}}
>
	{#each rows as row (row)}
		<view class="row"><text>{row}</text></view>
	{/each}
</scroll-view>
