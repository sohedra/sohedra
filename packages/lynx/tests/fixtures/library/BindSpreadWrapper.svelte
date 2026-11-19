<script lang="ts">
	import BindSpreadInner from "./BindSpreadInner.svelte";

	// Two bindings beside the rest of the props: this compiles to
	// `$.spread_props(() => rest, { get value() {…}, set value(v) {…}, … })`.
	let {
		value = $bindable(),
		ref = $bindable(null),
		...rest
	}: { value?: string; ref?: string | null; [prop: string]: unknown } = $props();
</script>

<BindSpreadInner bind:value bind:ref {...rest} />
