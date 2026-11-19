<!--
	Main-thread handlers that call the background, on elements of the same shape in both branches of
	{#if background}: hydration adopts the first frame's element as the background's. One handler is
	the same function in both branches; the other differs.
-->
<script lang="ts">
	import { runOnBackground } from "@sohedra/lynx";
	import { background } from "@sohedra/lynx/env";

	interface TapEvent {
		currentTarget: { setAttribute(name: string, value: unknown): void };
	}

	let { log }: { log: unknown[] } = $props();

	function note(...args: unknown[]) {
		log.push(args);
	}

	function same(event: TapEvent) {
		"main thread";
		runOnBackground(note)("same").catch((error: { code?: string }) => {
			event.currentTarget.setAttribute("refused", error.code);
		});
	}

	function onBackground(event: TapEvent) {
		"main thread";
		runOnBackground(note)("background's").catch((error: { code?: string }) => {
			event.currentTarget.setAttribute("refused", error.code);
		});
	}

	function inFrame(event: TapEvent) {
		"main thread";
		runOnBackground(note)("frame's").catch((error: { code?: string }) => {
			event.currentTarget.setAttribute("refused", error.code);
		});
	}
</script>

<view>
	{#if background}
		<view class="same" main-thread:ontap={same}></view>
	{:else}
		<view class="same" main-thread:ontap={same}></view>
	{/if}
	{#if background}
		<view class="differs" main-thread:ontap={onBackground}></view>
	{:else}
		<view class="differs" main-thread:ontap={inFrame}></view>
	{/if}
</view>
