<script lang="ts">
	import FrameFieldLabel from "./FrameFieldLabel.svelte";

	const uid = $props.id();
</script>

<view class="field"
	><FrameFieldLabel id={uid} /><input class="field-input" aria-labelledby={uid} /></view
>
