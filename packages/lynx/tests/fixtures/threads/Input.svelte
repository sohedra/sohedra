<script lang="ts">
	let text = $state("hello");
	let upper = $state(false);
	let later = $state(false);
	let card = $state(false);
	// A card number's digits, in groups of four.
	const grouped = (value: string) => value.replace(/\D/g, "").replace(/(\d{4})(?=\d)/g, "$1 ");
</script>

<input
	class="field"
	value={card ? grouped(text) : upper ? text.toUpperCase() : text}
	oninput={(event: { detail: { value: string } }) => (text = event.detail.value)}
/>
<textarea class="area" value={text}></textarea>
<view class="clear" ontap={() => (text = "")}><text>clear</text></view>
<view class="upper" ontap={() => (upper = true)}><text>upper</text></view>
<view class="later" ontap={() => (later = true)}><text>later</text></view>
<view
	class="card"
	ontap={() => {
		card = true;
		text = "12345678";
	}}><text>card</text></view
>
{#if later}
	<input class="made" value="from the start" />
{/if}
<text class="echo">{text}</text>
