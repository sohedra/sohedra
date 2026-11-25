<script lang="ts">
	let { throws }: { throws: boolean } = $props();
	if (throws) throw new Error("thrown");
</script>

<text class="ok">ok</text>
