<!--
	Rows whose main-thread tap handler calls nothing on the background: a long list of them holds
	no context there.
-->
<script lang="ts">
	let { count = 1000 }: { count?: number } = $props();
	const rows = Array.from({ length: count }, (_, index) => index + 1);

	function onTap(event: {
		currentTarget: { setStyleProperty(name: string, value: string): void };
	}) {
		"main thread";
		event.currentTarget.setStyleProperty("opacity", "0.5");
	}
</script>

<list class="list">
	{#each rows as id (id)}
		<list-item item-key="r{id}">
			<view class="row row-{id}" main-thread:ontap={onTap}></view>
		</list-item>
	{/each}
</list>
