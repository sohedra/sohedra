<script lang="ts">
	let { rows }: { rows: string[] } = $props();

	let picked = $state("");
</script>

<text class="picked">Picked: {picked || "none"}</text>
<list class="feed" list-type="single" span-count={1} scroll-orientation="vertical">
	{#each rows as row (row)}
		<list-item reuse-identifier="row">
			<text ontap={() => (picked = row)}>{row}</text>
		</list-item>
	{/each}
</list>
