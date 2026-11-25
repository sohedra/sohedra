<script lang="ts">
	import { background } from "@sohedra/lynx/environment";

	import FrameField from "./FrameField.svelte";
	import FrameLabeled from "./FrameLabeled.svelte";
</script>

{#if background}<FrameLabeled />{/if}
<FrameField />
