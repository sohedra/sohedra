<script lang="ts">
	import { on } from "svelte/events";

	type Layout = { detail: unknown };
	let { log }: { log: unknown[] } = $props();
	let fresh = $state(false);
	const nodes: Record<string, Element> = {};
	const keep = (name: string) => (node: unknown) => {
		nodes[name] = node as Element;
	};
	const hear = (name: string) => (event: Event) =>
		log.push([name, (event as unknown as Layout).detail]);
</script>

<view class="box" ontap={() => {}} {@attach keep("box")}><text>box</text></view>
<view
	class="heard"
	onlayoutchange={(event: Layout) => log.push(["markup", event.detail])}
	{@attach keep("heard")}
></view>
<view class="listen" ontap={() => on(nodes["box"]!, "layoutchange", hear("box"))}>
	<text>listen</text>
</view>
<view class="listen-heard" ontap={() => on(nodes["heard"]!, "layoutchange", hear("late"))}>
	<text>listen to heard</text>
</view>
<view class="add" ontap={() => (fresh = true)}><text>add</text></view>
{#if fresh}
	<view
		class="fresh"
		{@attach (node) => on(node as unknown as Element, "layoutchange", hear("fresh"))}
	></view>
{/if}
