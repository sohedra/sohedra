<script lang="ts">
	import { on } from "svelte/events";

	let { log }: { log: unknown[] } = $props();
	let box: Element | undefined;
	let off: (() => void) | undefined;
	const hear = (name: string) => (event: Event) => log.push([name, event.currentTarget === box]);
	async function listenLater() {
		await Promise.resolve();
		off = on(box!, "tap", hear("tap"));
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
<view class="listen" ontap={() => (off = on(box!, "longpress", hear("longpress")))}>
	<text>listen</text>
</view>
<view class="listen-later" ontap={listenLater}><text>later</text></view>
<view class="unlisten" ontap={() => off?.()}><text>unlisten</text></view>
