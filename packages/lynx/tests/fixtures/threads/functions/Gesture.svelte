<!-- A main-thread gesture: a kind of binding that binds nothing yet, and sets no attribute. -->
<script lang="ts">
	let { api }: { api: Record<string, unknown> } = $props();
	let on = $state(true);
	let step = $state(0);

	function onUpdate() {
		"main thread";
		}

	const gesture = $derived(on ? { type: 0, step, callbacks: { onUpdate } } : undefined);
	api["next"] = () => (step += 1);
	api["off"] = () => (on = false);
</script>

<view class="dragged" main-thread:gesture={gesture}></view>
