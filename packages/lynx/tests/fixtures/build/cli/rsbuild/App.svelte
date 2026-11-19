<script lang="ts">
	// Main-thread functions from a library in `node_modules`. Svelte's server copy, on the main
	// thread, drops an `$effect`'s body: there nothing reads `triple` but its registration.
	import { runOnMainThread } from "@sohedra/lynx";
	import { triple, widen } from "press-lib";

	let tripled = $state(0);
	let asked = $state(0);

	$effect(() => {
		if (asked > 0) void runOnMainThread(triple)(asked).then((value) => (tripled = value));
	});
</script>

<view class="press" main-thread:ontap={widen}>
	<text>Press</text>
</view>
<view class="ask" ontap={() => (asked = 2)}>
	<text>Tripled {tripled}</text>
</view>

<style>
	.press {
		margin-top: 7px;
	}
</style>
