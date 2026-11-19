<script lang="ts">
	let count = $state(0);
	let fruits = $state([
		{ id: 1, name: "Apple" },
		{ id: 2, name: "Banana" },
		{ id: 3, name: "Cherry" },
	]);
</script>

<view class="page">
	<text class="title">Svelte on Lynx</text>
	<view class="button" ontap={() => count++}>
		<text>Tapped {count} {count === 1 ? "time" : "times"}</text>
	</view>
	<view class="button" ontap={() => (fruits = [...fruits].reverse())}>
		<text>Reverse the list</text>
	</view>
	{#each fruits as fruit (fruit.id)}
		<view class="row">
			<text>{fruit.name}</text>
		</view>
	{/each}
</view>

<style>
	.page {
		padding: 24px;
	}
	.title {
		font-size: 24px;
		font-weight: bold;
	}
	.button {
		margin-top: 12px;
		padding: 12px;
		border-radius: 8px;
		background-color: #ff3e00;
	}
	.row {
		padding: 8px 0;
	}
</style>
