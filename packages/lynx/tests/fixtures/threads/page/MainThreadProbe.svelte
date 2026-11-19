<!-- Calls what only the background has while the component renders: the first frame shows what
each does there. -->
<script lang="ts">
	import { createStaticCopy, mount, root, unmount } from "@sohedra/lynx";

	import Layer from "./Layer.svelte";

	let { probe = false }: { probe?: boolean } = $props();
	const listener = () => {};

	/** What `call` returned, or the first line of what it threw. */
	function attempt(call: () => unknown): string {
		try {
			return String(call());
		} catch (error) {
			return String((error as Error).message).split("\n")[0]!;
		}
	}

	const outcomes = probe
		? [
				attempt(() => mount(Layer, { props: { label: "x", log: [] } })),
				attempt(() => unmount({})),
				attempt(() => createStaticCopy(root as never, root as never)),
				attempt(() => root.addEventListener("tap", listener)),
				attempt(() => root.removeEventListener("tap", listener)),
				attempt(() => root.isConnected),
				attempt(() => root.contains(null)),
			]
		: [];
</script>

<view class="page">
	{#each outcomes as outcome, index (index)}
		<text>{outcome}</text>
	{/each}
</view>
