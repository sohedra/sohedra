<script lang="ts">
	let rest = {
		maxLength: 4,
		"data-info": { a: 1 },
		catchphrase: "y",
		spreadName: "z",
		ontap: () => {},
	};
</script>

<view class="camel" maxLength={4} autoPlay={true} customName="x" {...rest}></view>
<view
	class="typed"
	span-count={2}
	sticky-top={false}
	accessibility-actions={["a", "b"]}
	data-quote="it's &lt;5&gt;"
></view>
<input class="field" value="typed" />
<view class="after-input"><text>after</text></view>
<textarea class="area" value="area text"></textarea>
<text class="sibling">sibling</text>
