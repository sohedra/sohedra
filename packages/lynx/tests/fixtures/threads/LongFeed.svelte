<script lang="ts">
	// A feed as a device measures it: each row a picture, four texts and a tap handler, written in
	// the list (`shape: "plain"`) or in a component whose root is the `<list-item>` (`"row"`).
	import FeedRow from "./FeedRow.svelte";

	let { count, shape = "plain" }: { count: number; shape?: "plain" | "row" } = $props();
	const rows = Array.from({ length: count }, (_, index) => ({ id: index + 1 }));
	let liked = $state(0);
</script>

<view class="page">
	<text class="status">{count} rows, liked {liked}</text>
	<list class="list" list-type="single" span-count={1}>
		{#if shape === "plain"}
			{#each rows as { id } (id)}
				<list-item item-key={String(id)} reuse-identifier="row">
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
				</list-item>
			{/each}
		{:else}
			{#each rows as { id } (id)}
				<FeedRow key={String(id)} reuse-identifier="row">
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
				</FeedRow>
			{/each}
		{/if}
	</list>
</view>
