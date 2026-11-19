<!-- A portal, as an app builds one on mount: its children are drawn above the page, with the
caller's context, and go with it. -->
<script lang="ts">
	import { mount, unmount } from "@sohedra/lynx";
	import { getAllContexts } from "svelte";
	import type { Snippet } from "svelte";

	import Render from "./Render.svelte";

	let { children }: { children: Snippet } = $props();
	// Read while the component starts: Svelte allows it only then.
	const context = getAllContexts();

	$effect(() => {
		const layer = mount(Render, { props: { children }, context });
		return () => unmount(layer);
	});
</script>
