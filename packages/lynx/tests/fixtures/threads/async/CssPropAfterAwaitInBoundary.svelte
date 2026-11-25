<!-- `CssPropAfterAwait`, in a boundary whose pending snippet the first frame draws. -->
<script lang="ts">
	import CssPropAfterAwait from "./CssPropAfterAwait.svelte";
</script>

<view class="page">
	<svelte:boundary>
		<CssPropAfterAwait />
		{#snippet pending()}<text class="pending">Loading</text>{/snippet}
	</svelte:boundary>
</view>
