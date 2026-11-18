<!-- An element with a spread and an empty class: Svelte's server writes the class, and its client sets none. -->
<script lang="ts">
	let { tone = "" }: { tone?: string } = $props();
	const extra = { "data-k": "v" };
</script>

<view class="outer">
	<view {...extra} class={tone}></view>
</view>
