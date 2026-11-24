<!-- A component that awaits, in a boundary whose pending snippet the first frame draws. -->
<script lang="ts">
	import Doubled from "./Doubled.svelte";
</script>

<view class="page">
	<svelte:boundary>
		<Doubled />
		{#snippet pending()}<text class="pending">Loading</text>{/snippet}
	</svelte:boundary>
</view>
