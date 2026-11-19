<script lang="ts">
	// Tells which thread's copy is rendering: the first frame's (Svelte's server renderer on the main
	// thread) or the app's (background).
	import { background, dev, mainThread } from "@sohedra/lynx/env";

	let { onrender }: { onrender: (thread: string, dev: boolean) => void } = $props();

	const thread = mainThread ? "main" : background ? "background" : "neither";
	// svelte-ignore state_referenced_locally
	onrender(thread, dev);
</script>

<text>{thread}</text>
