<script lang="ts">
	import { background } from "@sohedra/lynx/environment";

	let { handles = {} }: { handles?: Record<string, unknown> } = $props();
	const late = $state({ shown: false });
	handles["late"] = late;
</script>

{#if background}{:else}<text class="drawn">Drawn</text>{/if}
{#if late.shown}<view class="late"><text>Late</text></view>{/if}
