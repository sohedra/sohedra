<!-- A page that holds a bit of everything a reload must let go of: a tap handler, a main-thread
handler that calls the background, a gesture, a main-thread ref, a list, a layer left open and a
listener on the root. -->
<script lang="ts">
	import { mainThreadRef, mount, root, runOnBackground } from "@sohedra/lynx";
	import { PanGesture } from "@sohedra/lynx/gesture";
	import { on } from "svelte/events";

	import Layer from "./Layer.svelte";

	let { log, handles }: { log: unknown[]; handles: Record<string, unknown> } = $props();
	const box = mainThreadRef<unknown>(null);
	function record(value: unknown) {
		log.push(value);
	}

	function onMainTap() {
		"main thread";
		void runOnBackground(record)("main-thread tap");
	}

	function onPan() {
		"main thread";
		}

	const pan = new PanGesture({ onUpdate: onPan });

	$effect(() => {
		// Left open: the reload takes it away.
		mount(Layer, { props: { label: "reloaded", log } });
	});
	$effect(() => on(root, "tap", () => record("root tap"), { capture: true }));
</script>

<view class="page">
	<view class="tap" ontap={() => record("tap")}><text>tap</text></view>
	<view
		class="main"
		main-thread:ontap={onMainTap}
		main-thread:ref={box}
		main-thread:gesture={pan}
		{@attach (node) => void (handles["node"] = node)}
	></view>
	<list class="feed" list-type="single" span-count={1} scroll-orientation="vertical">
		{#each ["a", "b", "c"] as row (row)}
			<list-item class="cell" reuse-identifier="row"><text>{row}</text></list-item>
		{/each}
	</list>
</view>
