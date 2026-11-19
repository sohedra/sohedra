<script lang="ts">
	import type { LynxEvent, LynxNode } from "@sohedra/lynx/elements";
	import { on } from "svelte/events";

	let { log }: { log: unknown[] } = $props();
	let box: LynxNode<"view"> | undefined;
	const ready = Promise.resolve("ready");
	const hear = (name: string) => (event: LynxEvent) =>
		log.push([name, event.currentTarget === box]);
	async function listenLater() {
		await Promise.resolve();
		on(box!, "tap", hear("tap"));
	}
</script>

<view
	class="box"
	{@attach (node) => {
		box = node;
	}}
>
	<view class="inner"><text>inner</text></view>
</view>
{#await ready then value}<text class="ready">{value}</text>{/await}
<view class="listen-later" ontap={listenLater}><text>later</text></view>
