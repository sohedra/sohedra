<script lang="ts">
	let { b }: { b: boolean } = $props();
</script>

{#if b}<text class="b"></text>{:else}{#if b}{/if}<text class="c1"></text>{/if}
