<!--
	Gestures on parts that go: one only the first frame draws (the else branch of {#if background}),
	one the background draws in its place (another tag, so hydration does not keep the first), and one in a part `api` takes away. With `refuse`, an
	attribute differs on the two threads outside any block, so hydration cannot keep the first frame.
-->
<script lang="ts">
	import { background, mainThread } from "@sohedra/lynx/environment";
	import { PanGesture } from "@sohedra/lynx/gesture";
	import type { PanGestureChangeEvent, StateManager } from "@sohedra/lynx/gesture";

	let { api, refuse = false }: { api: Record<string, unknown>; refuse?: boolean } = $props();
	let shown = $state(true);
	const side = refuse && mainThread ? "frame" : "page";

	function onBegin(_event: PanGestureChangeEvent, state: StateManager) {
		"main thread";
		state.active();
	}

	const pan = new PanGesture({ onBegin });
	api["hide"] = () => (shown = false);
</script>

<view class="outer" data-side={side}>
	{#if background}
		<view class="late" main-thread:gesture={pan}></view>
	{:else}
		<scroll-view class="early" main-thread:gesture={pan}></scroll-view>
	{/if}
	{#if shown}
		<view class="part"><view class="inner" main-thread:gesture={pan}></view></view>
	{/if}
</view>
