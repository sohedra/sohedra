<!-- A page with elements to touch, a tap that catches, and a layer to open above it. With
`listen`, it listens on the page's root with on() for as long as an effect lives. -->
<script lang="ts">
	import { mount, root } from "@sohedra/lynx";
	import { on } from "svelte/events";

	import Layer from "./Layer.svelte";

	let {
		handles,
		log,
		heard = [],
		listen = false,
	}: {
		handles: Record<string, unknown>;
		log: unknown[];
		heard?: unknown[];
		listen?: boolean;
	} = $props();

	let active = $state(true);
	handles["listening"] = (value: boolean) => (active = value);

	$effect(() => {
		if (!listen || !active) return;
		const stops = ["touchstart", "touchmove", "touchend", "tap"].map((type) =>
			on(root, type, (event) => void heard.push(event), { capture: true }),
		);
		return () => stops.forEach((stop) => stop());
	});
</script>

<view class="page">
	<view
		class="plain"
		ontap={() => log.push("plain")}
		{@attach (node) => void (handles["plain"] = node)}
	></view>
	<view class="caught" oncatchtap={() => log.push("caught")}></view>
	<view
		class="open"
		ontap={() => (handles["layer"] = mount(Layer, { props: { label: "layer", log } }))}
	></view>
</view>
