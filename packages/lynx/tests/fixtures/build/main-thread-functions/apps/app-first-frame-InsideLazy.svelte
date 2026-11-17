<script lang="ts">
	function paint(event: {
		currentTarget: { setStyleProperty(name: string, value: string): void };
	}) {
		"main thread";
		event.currentTarget.setStyleProperty("color", "lazy-main-thread-marker");
	}
</script>

<view main-thread:ontap={paint}><text>lazy-template-marker</text></view>
