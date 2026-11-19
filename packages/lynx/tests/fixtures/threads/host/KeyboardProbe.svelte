<!-- Shows the keyboard, read for the first time when `.show` is tapped. -->
<script lang="ts">
	import { keyboard } from "@sohedra/lynx/host";

	let shown = $state(false);
</script>

<view class="page">
	<view class="show" ontap={() => (shown = true)}></view>
	{#if shown}
		<text class="keyboard"
			>{keyboard.current.open ? "open" : "closed"} {keyboard.current.height}</text
		>
	{/if}
</view>
