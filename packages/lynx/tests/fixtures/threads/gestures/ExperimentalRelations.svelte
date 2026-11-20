<!--
	The experimental relation options: a tap that waits for the pan around it, and a pan that hands
	the touch on to a fling. Each is built again when `distance` changes, and a second tap waits too.
-->
<script lang="ts">
	import { FlingGesture } from "@sohedra/lynx/experimental";
	import { PanGesture, TapGesture } from "@sohedra/lynx/gesture";

	let { api }: { api: Record<string, unknown> } = $props();
	let distance = $state(0);
	const outer = $derived(new PanGesture({ minDistance: distance }));
	const inner = $derived(new TapGesture({ maxDistance: distance + 10, waitFor: [outer] }));
	const other = $derived(new TapGesture({ waitFor: [outer] }));
	const fling = new FlingGesture();
	const handsOn = $derived(new PanGesture({ minDistance: distance, continueWith: [fling] }));
	api["far"] = () => (distance += 1);
</script>

<view class="outer" main-thread:gesture={outer}>
	<view class="inner" main-thread:gesture={inner}></view>
	<view class="other" main-thread:gesture={other}></view>
</view>
<view class="fling" main-thread:gesture={fling}></view>
<view class="hands-on" main-thread:gesture={handsOn}></view>
