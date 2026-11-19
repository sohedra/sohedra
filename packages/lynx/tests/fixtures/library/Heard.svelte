<script lang="ts">
	import { host } from "@sohedra/lynx/host";
	import { on } from "svelte/events";

	// Listens to one of the host's events for as long as the component lives, as a page does.
	let { name = "keyboardstatuschanged" }: { name?: string } = $props();
	let heard = $state<string[]>([]);

	$effect(() => on(host, name, (...args: unknown[]) => heard.push(JSON.stringify(args))));
</script>

<text class="heard">{heard.join(" ")}</text>
