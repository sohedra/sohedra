<!--
	A branch picked by data only the background has, such as a session: the first frame draws the
	other one, with the same tags.
-->
<script lang="ts">
	let { user, log }: { user?: string; log: unknown[] } = $props();
</script>

<view>
	{#if user}
		<text class="profile" ontap={() => log.push("open profile")}>{user}</text>
	{:else}
		<text class="login" ontap={() => log.push("log in")}>Log in</text>
	{/if}
</view>
