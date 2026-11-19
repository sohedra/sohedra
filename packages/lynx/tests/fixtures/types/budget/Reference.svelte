<!-- The reference component the instantiation budget measures: four tags, written as a page writes
them, and a component generic over the tag, as a UI library's part is. -->
<script lang="ts" generics="Tag extends 'view' | 'text' | 'image' | 'scroll-view'">
	import type { LynxElements, LynxTouchEvent } from "@sohedra/lynx/elements";

	let {
		as,
		attributes,
		items,
	}: {
		as: Tag;
		attributes: LynxElements[Tag];
		items: { id: string; label: string; image: string }[];
	} = $props();
	let selected = $state("");
	let offset = $state(0);

	function select(id: string) {
		return (event: LynxTouchEvent) => {
			selected = id;
			void event.detail.x;
		};
	}
</script>

<svelte:element this={as} class={attributes.class} style={attributes.style}></svelte:element>
<scroll-view
	class="feed"
	scroll-orientation="vertical"
	onscroll={(event) => (offset = event.detail.scrollTop)}
>
	{#each items as item (item.id)}
		<view class={["row", { selected: item.id === selected }]} ontap={select(item.id)}>
			<image class="avatar" src={item.image} mode="aspectFill" />
			<view class="body">
				<text class="title">{item.label}</text>
				<text class="subtitle" text-maxline="2">{item.id}</text>
			</view>
			<view class="actions" ontouchstart={(event) => void event.touches.length}>
				<text ontap={select(item.id)}>Open</text>
				<image src="chevron.png" onload={(event) => void event.detail.width} />
			</view>
		</view>
	{/each}
	<view class="footer" style="height: {offset}px"><text>End</text></view>
</scroll-view>
