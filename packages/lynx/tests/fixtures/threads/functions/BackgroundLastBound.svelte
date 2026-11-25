<!--
	A main-thread handler that calls the background, on an element in an {#if} block, followed by an
	element of the same tag that only the background renders, with a main-thread ref: in the run of
	blocks, the first frame's element has the shape of the background's last one, and both bind.
-->
<script lang="ts">
	import { mainThreadRef, runOnBackground } from "@sohedra/lynx";
	import { background } from "@sohedra/lynx/environment";

	interface TapEvent {
		currentTarget: { setAttribute(name: string, value: unknown): void };
	}

	let { log }: { log: unknown[] } = $props();
	const shown = true;
	const later = mainThreadRef<unknown>(null);

	function note(...args: unknown[]) {
		log.push(args);
	}

	function tapped(event: TapEvent) {
		"main thread";
		runOnBackground(note)("tapped").catch((error: { code?: string }) => {
			event.currentTarget.setAttribute("refused", error.code);
		});
	}
</script>

<view>
	{#if shown}
		<text class="tapped" main-thread:ontap={tapped}>tap</text>
	{/if}
	{#if background}
		<text class="later" main-thread:ref={later}>later</text>
	{/if}
</view>
