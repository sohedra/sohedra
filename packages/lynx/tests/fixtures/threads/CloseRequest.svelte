<script lang="ts">
	let { log }: { log: unknown[] } = $props();
	let listening = $state(true);
</script>

<overlay class="dialog" visible onrequestclose={listening ? () => log.push("close") : undefined}
></overlay>
<view class="stop" ontap={() => (listening = false)}></view>
<overlay
	class="sheet"
	visible
	main-thread:onrequestclose={() => {
		"main thread";
		return;
	}}
></overlay>
