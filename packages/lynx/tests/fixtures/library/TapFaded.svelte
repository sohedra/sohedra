<script lang="ts">
	// A main-thread tap handler that changes its element, as an app's would: the main thread shows
	// the change with a flush at the end of the tap's task.
	let { step = 1 }: { step?: number } = $props();
</script>

<view
	class="box"
	data-step={step}
	main-thread:ontap={(event) => {
		"main thread";
		event.currentTarget.setStyleProperty("opacity", "0.5");
	}}
></view>
