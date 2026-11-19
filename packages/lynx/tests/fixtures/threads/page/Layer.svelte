<!-- What the layer tests mount: the theme it sees, its taps, a main-thread tap and its end. -->
<script lang="ts">
	import { runOnBackground } from "@sohedra/lynx";
	import { getContext, onDestroy } from "svelte";

	let { label, log }: { label: string; log: unknown[] } = $props();
	const theme = getContext<string | undefined>("theme") ?? "none";
	function report(value: unknown) {
		log.push(value);
	}
	onDestroy(() => log.push(`destroyed ${label}`));

	function tapOnMainThread() {
		"main thread";
		void runOnBackground(report)("main-thread tap");
	}
</script>

<view class="layer {label}" ontap={() => log.push(`tap ${label}`)}>
	<text class="theme">{theme}</text>
	<view class="mt" main-thread:ontap={tapOnMainThread}></view>
</view>
