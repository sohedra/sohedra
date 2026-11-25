<!--
	A boundary whose children throw on one thread or both.
-->
<script lang="ts">
	import Thrower from "./Thrower.svelte";
	let { throws, log }: { throws: boolean; log: unknown[] } = $props();
</script>

<view class="box">
	<text class="before" ontap={() => log.push("before")}>before</text>
	<svelte:boundary>
		{#snippet failed()}<text class="item" ontap={() => log.push("failed")}>failed</text>{/snippet}
		<Thrower {throws} />
	</svelte:boundary>
	<text class="after" ontap={() => log.push("after")}>after</text>
</view>
