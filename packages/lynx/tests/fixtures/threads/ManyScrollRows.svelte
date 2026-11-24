<script lang="ts">
	// Two scroll views at two places, since a warning is given once per place.
	let { count, later = false }: { count: number; later?: boolean } = $props();
	let rows = $state(Array.from({ length: count }, (_, index) => index));
	const add = (): void => {
		rows = [...rows, ...Array.from({ length: 60 }, (_, index) => rows.length + index)];
	};
</script>

{#snippet each()}
	{#each rows as row (row)}
		<view><text>{row}</text></view>
	{/each}
{/snippet}

<view class="more" ontap={add}><text>more</text></view>
{#if later}
	<scroll-view scroll-orientation="vertical">{@render each()}</scroll-view>
{:else}
	<scroll-view scroll-orientation="vertical">{@render each()}</scroll-view>
{/if}
