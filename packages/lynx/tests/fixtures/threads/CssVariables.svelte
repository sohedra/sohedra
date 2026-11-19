<script lang="ts">
	import CssChild from "./CssChild.svelte";
	let size = $state(1);
</script>

<view class="host">
	<CssChild --tone="green" --size="{size}px" />
</view>
<CssChild --root="1" />
<view class="grow" ontap={() => size++}><text>grow</text></view>
