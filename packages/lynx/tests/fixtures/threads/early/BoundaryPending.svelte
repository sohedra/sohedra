<!--
	A boundary with a pending snippet: the first frame draws it, the background its children.
-->
<script lang="ts">
	let { log }: { log: unknown[] } = $props();
</script>

<view class="box">
	<svelte:boundary>
		{#snippet pending()}<text class="item" ontap={() => log.push("pending")}>Loading</text
			>{/snippet}
		<text class="item" ontap={() => log.push("child")}>child</text>
	</svelte:boundary>
	<text class="after" ontap={() => log.push("after")}>after</text>
</view>
