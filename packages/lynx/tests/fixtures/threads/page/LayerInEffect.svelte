<!-- A page that mounts a layer in an effect, which the first frame never runs. -->
<script lang="ts">
	import { mount } from "@sohedra/lynx";

	import Layer from "./Layer.svelte";

	let { log }: { log: unknown[] } = $props();

	$effect(() => {
		mount(Layer, { props: { label: "effect", log } });
	});
</script>

<view class="page"><text class="drawn">drawn</text></view>
<view class="tail"><text>tail</text></view>
