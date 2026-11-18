<!--
	Gestures that change elements in one patch: with `flip`, a pan moves to an element made in the
	patch while its old element takes a tap; with `swap`, two elements swap their pans, one of which
	a third element's tap waits for.
-->
<script lang="ts">
	import { PanGesture, TapGesture } from "@sohedra/lynx/gesture";
	import type { GestureKind } from "@sohedra/lynx/gesture";

	let { api }: { api: Record<string, unknown> } = $props();
	let flag = $state(false);
	let swapped = $state(false);
	const pan = new PanGesture({ minDistance: 1 });
	let tap = $state.raw<GestureKind>(new TapGesture());
	const p = new PanGesture({ minDistance: 5 });
	const q = new PanGesture({ minDistance: 6 });
	const t = new TapGesture({ waitFor: [p] });
	api["flip"] = () => (flag = !flag);
	api["rebuildTap"] = () => (tap = new TapGesture({ maxDuration: 300 }));
	api["swap"] = () => (swapped = !swapped);
</script>

{#if flag}<view class="a" main-thread:gesture={pan}></view>{/if}
<view class="b" main-thread:gesture={flag ? tap : pan}></view>
<view class="x" main-thread:gesture={swapped ? q : p}></view>
<view class="y" main-thread:gesture={swapped ? p : q}></view>
<view class="t" main-thread:gesture={t}></view>
