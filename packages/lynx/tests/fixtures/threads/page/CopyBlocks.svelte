<!-- The container of a static copy (the row `b`) among siblings, inside an {#if} and keyed
{#each} blocks. The test drives it through `handles.api`. -->
<script lang="ts">
	let { handles }: { handles: Record<string, unknown> } = $props();

	let show = $state(true);
	let text = $state("one");
	let before = $state<string[]>([]);
	let after = $state<string[]>([]);
	let rows = $state(["a", "b", "c"]);
	handles["api"] = {
		setShow: (value: boolean) => (show = value),
		setText: (value: string) => (text = value),
		setBefore: (value: string[]) => (before = value),
		setAfter: (value: string[]) => (after = value),
		setRows: (value: string[]) => (rows = value),
	};
</script>

<view class="page">
	{#if show}
		<view class="block">
			<text class="lead">{text}</text>
			<view class="src" {@attach (node) => void (handles["src"] = node)}>
				<text class="src-text">{text}</text>
			</view>
			{#each before as item (item)}
				<text class="before">{item}</text>
			{/each}
			{#each rows as row (row)}
				<view class="row" data-row={row} {@attach (node) => void (handles[`row-${row}`] = node)}
				></view>
			{/each}
			{#each after as item (item)}
				<text class="after">{item}</text>
			{/each}
			<text class="tail">{text}</text>
		</view>
	{/if}
</view>
