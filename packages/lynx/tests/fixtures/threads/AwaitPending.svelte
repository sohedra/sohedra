<!--
	An `{#await}` block with a pending branch, between elements of the page: its promise settles at
	once, or never. A tap on `.next` gives it a new promise.
-->
<script lang="ts">
	let { settles }: { settles: boolean } = $props();
	let round = $state(1);
	let value = $state(settles ? Promise.resolve("round 1") : new Promise<string>(() => {}));

	function next() {
		round++;
		value = Promise.resolve(`round ${round}`);
	}
</script>

<view class="root">
	<text class="title">Title</text>
	{#await value}
		<text class="pending">Loading</text>
	{:then text}
		<text class="value">{text}</text>
	{/await}
	<view class="next" ontap={next}><text>next</text></view>
</view>
