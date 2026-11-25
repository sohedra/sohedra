<!-- sveltejs/svelte#19355: a CSS custom property whose value is declared after a top-level await. -->
<script lang="ts">
	import CssChild from "../CssChild.svelte";

	await Promise.resolve();
	let size = $state(1);
</script>

<view class="host">
	<CssChild --size="{size}px" />
</view>
<view class="grow" ontap={() => size++}><text>grow</text></view>
