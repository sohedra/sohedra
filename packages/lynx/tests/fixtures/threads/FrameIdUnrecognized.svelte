<script lang="ts">
	import { background } from "@sohedra/lynx/environment";

	import FrameLabeled from "./FrameLabeled.svelte";
</script>

{#if background === true}<FrameLabeled />{/if}
{#each [1, 2] as item (item)}<FrameLabeled />{/each}
