<!--
	A component that calls $props.id() in an {#await}'s pending branch, and one after the block.
-->
<script lang="ts">
	import IdChild from "./IdChild.svelte";
	let { given }: { given: unknown } = $props();
</script>

<view class="box">
	{#await given}
		<IdChild name="pending" />
	{:then value}
		<IdChild name="then" />
	{/await}
	<IdChild name="after" />
</view>
