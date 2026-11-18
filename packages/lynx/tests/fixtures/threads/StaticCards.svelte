<script lang="ts">
	// A large static page with no list, as a device measures it: `count` cards, each a picture, six
	// texts and a tap handler, in a plain `<view>`.
	let { count }: { count: number } = $props();
	const rows = Array.from({ length: count }, (_, index) => ({ id: index + 1 }));
	let liked = $state(0);
</script>

{#snippet card(id: number)}
	<view class="row">
		<image class="picture" src={`picture.png?row=${id}`} />
		<view class="body">
			<text class="title">Row {id}</text>
			<text class="subtitle">A line of text under the title of row {id}</text>
			<view class="meta">
				<text class="tag">tag</text>
				<text class="tag">{id % 7} min</text>
				<text class="tag">#{id % 13}</text>
			</view>
			<view class="actions">
				<view class="action" ontap={() => (liked = id)}><text>Like</text></view>
				<view class="action"><text>Share</text></view>
			</view>
		</view>
	</view>
{/snippet}

<view class="page">
	<text class="status">{count} static cards, liked {liked}</text>
	<view class="cards">
		{#each rows as row (row.id)}
			{@render card(row.id)}
		{/each}
	</view>
</view>
