<script lang="ts">
	let { value = $bindable(), ref = $bindable(null) }: { value?: string; ref?: string | null } =
		$props();

	$effect(() => {
		value = "inner";
		ref = "set";
	});
</script>

<text>inner: {value} {ref}</text>
