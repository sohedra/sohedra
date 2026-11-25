<!--
	A branch picked by data only the background has, inside a <text>: the branches differ only in
	the loose text before their element.
-->
<script lang="ts">
	let { owner, log }: { owner?: boolean; log: unknown[] } = $props();
</script>

<view>
	<text class="line">
		{#if owner}
			Yours:
			<text class="go" ontap={() => log.push("edit")}>Open</text>
		{:else}
			Shared:
			<text class="go" ontap={() => log.push("view")}>Open</text>
		{/if}
	</text>
</view>
