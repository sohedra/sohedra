<script lang="ts">
	let text = $state("hello");
	let upper = $state(false);
	let later = $state(false);
</script>

<input
	class="field"
	value={upper ? text.toUpperCase() : text}
	oninput={(event: { detail: { value: string } }) => (text = event.detail.value)}
/>
<textarea class="area" value={text}></textarea>
<view class="clear" ontap={() => (text = "")}><text>clear</text></view>
<view class="upper" ontap={() => (upper = true)}><text>upper</text></view>
<view class="later" ontap={() => (later = true)}><text>later</text></view>
{#if later}
	<input class="made" value="from the start" />
{/if}
<text class="echo">{text}</text>
