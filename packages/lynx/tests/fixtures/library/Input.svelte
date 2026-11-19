<script lang="ts">
	let text = $state("hello");
	let upper = $state("");
</script>

<input class="field" value={text} oninput={(event) => (text = event.detail.value)} />
<text class="echo">{text}</text>
<view class="clear" ontap={() => (text = "")}></view>
<!-- A setter that changes what was typed. -->
<input
	class="upper-field"
	value={upper}
	oninput={(event) => (upper = event.detail.value.toUpperCase())}
/>
<text class="upper">{upper}</text>
