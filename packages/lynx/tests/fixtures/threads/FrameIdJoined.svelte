<script lang="ts">
	import { background } from "@sohedra/lynx/environment";

	import FrameLabeled from "./FrameLabeled.svelte";

	let { ready = true }: { ready?: boolean } = $props();
</script>

{#if background && ready}<FrameLabeled />{/if}
<FrameLabeled />
