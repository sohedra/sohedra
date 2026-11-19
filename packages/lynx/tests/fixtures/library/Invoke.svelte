<script lang="ts">
	import type { LynxNode } from "@sohedra/lynx/elements";

	let { results }: { results: unknown[] } = $props();
	let scroller: LynxNode<"scroll-view"> | undefined;
	let measured: LynxNode<"view"> | undefined;
	let show = $state(true);
	let added = $state(false);

	const record = (promise: Promise<unknown>) =>
		promise.then(
			(value) => results.push({ ok: value }),
			(error: Error) => results.push({ error: error.message }),
		);
</script>

{#if show}
	<scroll-view
		class="scroller"
		{@attach (node) => {
			scroller = node;
		}}><text>rows</text></scroll-view
	>
{/if}
<view
	class="scroll"
	ontap={() => record(scroller!.invoke("scrollTo", { offset: 120, smooth: true }))}
></view>
<view class="hide" ontap={() => (show = false)}></view>
<view
	class="measure"
	{@attach (node) => {
		measured = node;
	}}
	ontap={() => record(measured!.invoke("boundingClientRect", {}))}
></view>
<!-- Adds an element and invokes on it in the same update. -->
<view class="add" ontap={() => (added = true)}></view>
{#if added}
	<view
		class="fresh"
		{@attach (node) => {
			record(node.invoke("boundingClientRect", {}));
		}}
	></view>
{/if}
