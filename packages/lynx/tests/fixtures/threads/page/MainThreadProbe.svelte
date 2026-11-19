<!-- Calls what only the background has while the component renders: the first frame shows what
each does there. -->
<script lang="ts">
	import { createStaticCopy, mount, root, unmount } from "@sohedra/lynx";

	import Layer from "./Layer.svelte";

	let { probe = false }: { probe?: boolean } = $props();
	const listener = () => {};

	function attempt(call: () => unknown): string {
		try {
			call();
			return "returned";
		} catch (error) {
			return (error as { code?: string }).code ?? String(error);
		}
	}

	const outcomes = probe
		? [
				attempt(() => mount(Layer, { props: { label: "x", log: [] } })),
				attempt(() => unmount({})),
				attempt(() => createStaticCopy(root as never, root as never)),
				attempt(() => root.addEventListener("tap", listener)),
				attempt(() => root.removeEventListener("tap", listener)),
			]
		: [];
</script>

<view class="page">
	{#each outcomes as outcome, index (index)}
		<text>{outcome}</text>
	{/each}
</view>
