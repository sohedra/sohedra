<!--
	A dynamic component that is nothing: the first frame writes an empty second state.
-->
<script lang="ts">
	import type { Component } from "svelte";
	let { Shown = null, log }: { Shown?: Component | null; log: unknown[] } = $props();
</script>

<view class="box">
	<Shown />
	<text class="after" ontap={() => log.push("after")}>after</text>
</view>
