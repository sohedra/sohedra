<script lang="ts">
	import { on } from "svelte/events";

	let { log }: { log: unknown[] } = $props();
	let box: Element | undefined;
	const ready = Promise.resolve("ready");
	const hear = (name: string) => (event: Event) => log.push([name, event.currentTarget === box]);
	async function listenLater() {
		await Promise.resolve();
		on(box!, "tap", hear("tap"));
	}
</script>

<view
	class="box"
	{@attach (node) => {
		box = node as unknown as Element;
	}}
>
	<view class="inner"><text>inner</text></view>
</view>
{#await ready then value}<text class="ready">{value}</text>{/await}
<view class="listen-later" ontap={listenLater}><text>later</text></view>
