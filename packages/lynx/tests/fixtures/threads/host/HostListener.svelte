<!-- Listens to the host's event `name` from an effect, and keeps what each call got. A tap on
`.switch` listens to `next` instead. -->
<script lang="ts">
	import { host } from "@sohedra/lynx/host";
	import { on } from "svelte/events";

	let { name, next = name, log }: { name: string; next?: string; log: unknown[][] } = $props();
	// svelte-ignore state_referenced_locally
	let current = $state(name);

	$effect(() => on(host, current, (...args) => void log.push(args)));
</script>

<view class="switch" ontap={() => (current = next)}><text>{current}</text></view>
