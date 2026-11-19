<script lang="ts">
	let taps = $state(0);
	const big = { n: 1n };
	const items = [1];
</script>

<view class="unsendable" data-big={big} title="kept"></view>
<list>
	{#each items as item (item)}
		<list-item item-key="a"><view class="in-cell" data-big={big} title="kept"></view></list-item>
	{/each}
</list>
<view
	class="throws"
	ontap={() => {
		taps++;
		throw new Error("the handler threw");
	}}
></view>
<text class="taps">{taps}</text>
