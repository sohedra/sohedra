<svelte:options runes />

<script lang="ts">
	import { mainThreadRef } from "@sohedra/lynx";
	import type { LynxNode, LynxTouchEvent, MainThread } from "@sohedra/lynx/elements";
	import { PanGesture } from "@sohedra/lynx/gesture";
	import { on } from "svelte/events";

	let { rows }: { rows: { id: string; label: string }[] } = $props();
	let text = $state("");
	let scroller: LynxNode<"scroll-view"> | undefined;
	const box = mainThreadRef<MainThread.Element | null>(null);
	const pan = new PanGesture({ minDistance: 4 });

	function tapped(event: LynxTouchEvent) {
		const x: number = event.detail.x;
		const id: string = event.currentTarget.id;
		void [x, id];
	}

	function listen(node: LynxNode<"view">) {
		return on(node, "tap", (event) => {
			const self: LynxNode<"view"> = event.currentTarget;
			const touches: number = event.touches.length;
			void [self, touches];
		});
	}
</script>

<view class={["page", { empty: rows.length === 0 }]} style="padding: 8px" data-screen="home">
	<text ontap={tapped} oncatchlongpress={(event) => void event.detail.y}>Hello</text>
	<view {@attach listen} main-thread:ref={box} main-thread:gesture={pan}></view>
	<view
		main-thread:ref={(element) => {
			"main thread";
			element.setStyleProperty("opacity", "1");
			return () => element.setStyleProperty("opacity", "0");
		}}
		main-thread:ontouchmove={(event) => {
			"main thread";
			event.currentTarget.setStyleProperty("left", `${event.detail.x}px`);
			event.stopPropagation();
		}}
	></view>
	<scroll-view
		scroll-orientation="vertical"
		{@attach (node) => void (scroller = node)}
		onscroll={(event) => void event.detail.scrollTop}
	>
		<list custom-list-name="list-container">
			{#each rows as row (row.id)}
				<list-item reuse-identifier="row" defer={{ unmountRecycled: true }}>
					<text>{row.label}</text>
				</list-item>
			{/each}
		</list>
	</scroll-view>
	<input value={text} oninput={(event) => (text = event.detail.value)} />
	<overlay visible events-pass-through ononRequestClose={() => {}} onrequestclose={() => {}}
	></overlay>
	<image src="a.png" onload={(event) => void [event.detail.width, event.detail.height]} />
	<view ontap={() => scroller?.invoke("scrollTo", { offset: 0, smooth: true })}></view>
	<svelte:boundary onerror={() => {}}>
		<view></view>
	</svelte:boundary>
</view>
