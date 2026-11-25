<!-- An `{#await}` block whose promise a tap replaces. -->
<script lang="ts">
	let round = $state(1);
	let value = $state(Promise.resolve("round 1"));

	function next() {
		round++;
		value = Promise.resolve(`round ${round}`);
	}
</script>

<view class="root">
	{#await value}
		<text class="pending">Loading</text>
	{:then text}
		<text class="value">{text}</text>
	{/await}
	<view class="next" ontap={next}><text>next</text></view>
</view>
