<script lang="ts">
	import type { LynxLayoutChangeEvent, LynxNode } from "@sohedra/lynx/elements";
	import { on } from "svelte/events";

	let { log }: { log: unknown[] } = $props();
	let fresh = $state(false);
	let off: (() => void) | undefined;
	const nodes: Record<string, LynxNode<"view">> = {};
	const keep = (name: string) => (node: LynxNode<"view">) => {
		nodes[name] = node;
	};
	const hear = (name: string) => (event: LynxLayoutChangeEvent) => log.push([name, event.detail]);
</script>

<view class="box" ontap={() => {}} {@attach keep("box")}><text>box</text></view>
<view
	class="heard"
	onlayoutchange={(event) => log.push(["markup", event.detail])}
	{@attach keep("heard")}
></view>
<view class="listen" ontap={() => (off = on(nodes["box"]!, "layoutchange", hear("box")))}>
	<text>listen</text>
</view>
<view class="unlisten" ontap={() => off?.()}><text>unlisten</text></view>
<view class="listen-heard" ontap={() => on(nodes["heard"]!, "layoutchange", hear("late"))}>
	<text>listen to heard</text>
</view>
<view class="add" ontap={() => (fresh = true)}><text>add</text></view>
{#if fresh}
	<view class="fresh" {@attach (node) => on(node, "layoutchange", hear("fresh"))}></view>
{/if}
