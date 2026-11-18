<script lang="ts">
	import FrameBoundChild from "./FrameBoundChild.svelte";
	import FrameIds from "./FrameIds.svelte";

	let value: number | undefined = $state();
</script>

<FrameIds />
<FrameBoundChild bind:value />
<FrameIds />
