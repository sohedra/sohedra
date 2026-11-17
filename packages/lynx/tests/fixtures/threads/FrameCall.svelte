<script lang="ts">
	type Node = { invoke(method: string, params?: Record<string, unknown>): Promise<unknown> };
	let { results }: { results: unknown[] } = $props();
	let mounted = $state(false);
	$effect(() => {
		mounted = true;
	});
</script>

<scroll-view
	class="scroller"
	{@attach (node) => {
		(node as unknown as Node).invoke("scrollTo", { offset: 40 }).then(
			(value) => results.push({ ok: value }),
			(error: unknown) => results.push({ error }),
		);
	}}
>
	<text>{mounted ? "mounted" : "drawn"}</text>
	{#if !mounted}<text class="hint">swipe</text>{/if}
	<text>footer</text>
</scroll-view>
