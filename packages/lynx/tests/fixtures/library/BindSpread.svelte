<script lang="ts">
	import BindSpreadWrapper from "./BindSpreadWrapper.svelte";

	let value = $state("parent");
	let ref = $state<string | null>(null);
</script>

<BindSpreadWrapper bind:value bind:ref />
<text>value: {value}</text>
<text>ref: {ref ?? "none"}</text>
