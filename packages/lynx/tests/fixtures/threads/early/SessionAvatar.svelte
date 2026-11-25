<!--
	A branch picked by data only the background has, with other tags: the first frame's element is
	made again.
-->
<script lang="ts">
	let { user, log }: { user?: string; log: unknown[] } = $props();
</script>

<view>
	{#if user}
		<image class="avatar" src={user} ontap={() => log.push("open profile")} />
	{:else}
		<text class="login" ontap={() => log.push("log in")}>Log in</text>
	{/if}
</view>
