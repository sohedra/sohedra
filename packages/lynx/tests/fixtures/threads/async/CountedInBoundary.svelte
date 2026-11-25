<!-- A component that awaits, in a boundary whose pending snippet the first frame draws. -->
<script lang="ts">
	import Counted from "./Counted.svelte";
</script>

<view class="page">
	<text class="title">Title</text>
	<svelte:boundary>
		<Counted />
		{#snippet pending()}<text class="pending">Loading</text>{/snippet}
	</svelte:boundary>
</view>
