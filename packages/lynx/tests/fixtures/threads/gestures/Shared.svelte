<!--
	One pan shared by an element hydration keeps and a part only the background draws, which comes
	before it; a tap that waits for the pan; rows of an {#each} that share one gesture whose
	callback reads the list, so adding a row builds it again in the same flush; and a pan whose
	options differ on the two threads.
-->
<script lang="ts">
	import { background, mainThread } from "@sohedra/lynx/env";
	import { PanGesture, TapGesture } from "@sohedra/lynx/gesture";
	import type { PanGestureChangeEvent, StateManager } from "@sohedra/lynx/gesture";

	let { api }: { api: Record<string, unknown> } = $props();
	let items = $state([1, 2]);

	function onBegin(_event: PanGestureChangeEvent, state: StateManager) {
		"main thread";
		state.active();
	}

	function onRow(event: PanGestureChangeEvent, state: StateManager) {
		"main thread";
		state.active();
		event.currentTarget.setAttribute("rows", items.length);
	}

	const pan = $derived(new PanGesture({ onBegin }));
	const waits = $derived(new TapGesture({ waitFor: [pan] }));
	const rowPan = $derived(new PanGesture({ minDistance: 2, onBegin: onRow }));
	const differs = $derived(new PanGesture({ minDistance: mainThread ? 0 : 4, onBegin }));
	api["add"] = () => (items = [0, ...items]);
</script>

<view class="outer">
	{#if background}
		<view class="late" main-thread:gesture={pan}></view>
	{/if}
	<view class="kept" main-thread:gesture={pan}></view>
	<view class="waits" main-thread:gesture={waits}></view>
	<view class="differs" main-thread:gesture={differs}></view>
	{#each items as id (id)}
		<view class="row row-{id}" main-thread:gesture={rowPan}></view>
	{/each}
</view>
