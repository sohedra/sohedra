<script lang="ts">
	let { seen }: { seen: (name: string, value: unknown) => void } = $props();
	let items = $state([1, 2, 3]);
	let marked = $state(true);
	let shown = $state(true);
	const keep = (name: string) => (node: unknown) => seen(name, node);
</script>

<view class="plain" {@attach keep("plain")} ontap={(event: unknown) => seen("plain-event", event)}
></view>
<view
	class="tagged"
	id="tagged"
	data-n={1}
	data-s="x"
	data-o={{ a: 1 }}
	data-mark={marked ? "yes" : null}
	{@attach keep("tagged")}
	ontap={(event: unknown) => seen("tagged-event", event)}
>
	<text {@attach keep("text")}>tagged</text>
</view>
{#each items as item (item)}
	<view class="item item-{item}" {@attach keep(`item-${item}`)}><text>{item}</text></view>
{/each}
{#if shown}
	<view class="gone" {@attach keep("gone")}><view {@attach keep("inner")}></view></view>
{/if}
<view
	class="change"
	ontap={() => {
		items = items.toReversed();
		marked = false;
		shown = false;
	}}
></view>
