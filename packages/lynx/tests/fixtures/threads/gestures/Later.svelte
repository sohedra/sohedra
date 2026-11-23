<!--
	A sheet's pan names a scroll gesture built again a patch before the scroll view gets it, and a
	pan turned off and on again (`on ? pan : undefined`), as an app turns a gesture off.
-->
<script lang="ts">
	import { DefaultScrollGesture, PanGesture } from "@sohedra/lynx/gesture";
	import type { Gesture } from "@sohedra/lynx/gesture";

	let { api }: { api: Record<string, unknown> } = $props();
	let shown = $state.raw<Gesture>(new DefaultScrollGesture());
	let named = $state.raw<Gesture>(shown);
	let on = $state(true);
	let next: Gesture | undefined;
	const sheet = $derived(new PanGesture({ waitFor: [named] }));
	const toggled = new PanGesture({ minDistance: 3 });
	api["name"] = () => {
		next = new DefaultScrollGesture();
		named = next;
	};
	api["show"] = () => (shown = next!);
	api["toggle"] = () => (on = !on);
</script>

<view class="sheet" main-thread:gesture={sheet}>
	<scroll-view class="scroll" scroll-y main-thread:gesture={shown}></scroll-view>
</view>
<view class="toggled" main-thread:gesture={on ? toggled : undefined}></view>
