<script lang="ts">
	// The container of a static copy among siblings, inside an `{#if}` and a keyed `{#each}`. The
	// test drives it through `handles.api`.
	// oxlint-disable-next-line typescript/no-explicit-any -- the test reads what the attachments got
	let { handles }: { handles: Record<string, any> } = $props();

	let show = $state(true);
	let text = $state("one");
	let rows = $state(["a", "b", "c"]);

	$effect(() => {
		handles.api = {
			setShow: (value: boolean) => (show = value),
			setText: (value: string) => (text = value),
			setRows: (value: string[]) => (rows = value),
		};
	});
</script>

<view class="page">
	{#if show}
		<view class="block">
			<text class="lead">{text}</text>
			<view class="src" {@attach (node) => void (handles.src = node)}>
				<text class="src-text">{text}</text>
			</view>
			{#each rows as row (row)}
				<view class="row" data-row={row} {@attach (node) => void (handles[`row-${row}`] = node)}
				></view>
			{/each}
			<text class="tail">{text}</text>
		</view>
	{/if}
</view>
