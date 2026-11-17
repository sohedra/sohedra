<script lang="ts">
	// Loaded lazily: its CSS and its main-thread function travel in its bundle.
	let { label = "heavy" }: { label?: string } = $props();

	function onHeavyTap() {
		"main thread";
		console.log("heavy-main-thread-tap");
	}
</script>

<view class="heavy" main-thread:ontap={onHeavyTap}><text class="heavy-label">{label}</text></view>

<style>
	.heavy {
		background-color: #2b6cb0;
	}
	.heavy-label {
		color: #fefcbf;
	}
</style>
