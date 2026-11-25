<!-- `DoubledModule`, in a boundary whose pending snippet the first frame draws. -->
<script lang="ts">
	import DoubledModule from "./DoubledModule.svelte";
</script>

<view class="page">
	<svelte:boundary>
		<DoubledModule />
		{#snippet pending()}<text class="pending">Loading</text>{/snippet}
	</svelte:boundary>
</view>
