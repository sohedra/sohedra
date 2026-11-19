<!--
	Relations between elements' gestures. `inner` waits for `outer`'s pan and comes first, so it is
	set before the gesture it names; `shared` has the same pan as `outer`. A sheet's pan waits for
	the scrolling of the scroll-view inside it, which is set after it. Both pans are built again when
	`distance` changes, `$derived` as an app writes them; `api` also takes `shared` away. `three` is
	a composition whose members each wait for those before them; `right` may run with `left`.
-->
<script lang="ts">
	import { ExclusiveGesture, LongPressGesture, waitFor } from "@sohedra/lynx/experimental";
	import { DefaultScrollGesture, PanGesture, TapGesture } from "@sohedra/lynx/gesture";

	let { api }: { api: Record<string, unknown> } = $props();
	let distance = $state(0);
	let shown = $state(true);
	const outer = $derived(new PanGesture({ minDistance: distance }));
	const inner = $derived(waitFor(new TapGesture(), [outer]));
	const scroll = new DefaultScrollGesture();
	const sheet = $derived(waitFor(new PanGesture({ minDistance: distance }), [scroll]));
	const three = new ExclusiveGesture(new PanGesture(), new TapGesture(), new LongPressGesture());
	const left = new PanGesture();
	const right = new PanGesture({ simultaneousWith: [left] });
	api["far"] = () => (distance += 1);
	api["toggle"] = () => (shown = !shown);
</script>

<view class="inner" main-thread:gesture={inner}></view>
<view class="outer" main-thread:gesture={outer}></view>
{#if shown}<view class="shared" main-thread:gesture={outer}></view>{/if}
<view class="sheet" main-thread:gesture={sheet}>
	<scroll-view class="scroll" scroll-y main-thread:gesture={scroll}></scroll-view>
</view>
<view class="three" main-thread:gesture={three}></view>
<view class="left" main-thread:gesture={left}></view>
<view class="right" main-thread:gesture={right}></view>
