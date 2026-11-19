<script lang="ts">
	// A page of two touch targets, and a button that mounts a layer with a third.
	import { mount } from "@sohedra/lynx";

	import TouchableLayer from "./TouchableLayer.svelte";

	// oxlint-disable-next-line typescript/no-explicit-any -- the test reads what the attachments got
	let { handles }: { handles: Record<string, any> } = $props();
</script>

<view class="page" {@attach (node) => void (handles.page = node)}>
	<text class="plain" {@attach (node) => void (handles.plain = node)}>Plain</text>
	<text class="caught" oncatchtap={() => {}}>Caught</text>
	<view class="open" ontap={() => mount(TouchableLayer, { props: { handles } })}>
		<text>Open</text>
	</view>
</view>
