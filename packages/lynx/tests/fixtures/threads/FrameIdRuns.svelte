<script lang="ts">
	import { background } from "@sohedra/lynx/env";

	import FrameLabeled from "./FrameLabeled.svelte";
</script>

{#if background}<FrameLabeled />{/if}
<FrameLabeled />
{#if background}<FrameLabeled />{/if}
<FrameLabeled />
