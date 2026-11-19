<script lang="ts">
	// Hears a tap anywhere on the page through its root, while `listening`, and says which element
	// got it: in the capture phase, before the element's own handler.
	import { root } from "@sohedra/lynx";
	import { on } from "svelte/events";

	let heard = $state<string[]>([]);
	let listening = $state(true);

	$effect(() => {
		if (!listening) return;
		return on(root, "tap", (event: { target: { id: string } }) => heard.push(event.target.id), {
			capture: true,
		});
	});
</script>

<view id="listener"></view>
<view id="elsewhere"></view>
<view id="stop" ontap={() => (listening = false)}></view>
<text id="heard">{heard.join(" | ")}</text>
