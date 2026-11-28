<!-- Reads a context set outside the popover, from inside the portalled popup. -->
<script lang="ts">
	import { getContext } from "svelte";

	const value = getContext<string>("outside");
</script>

<span data-testid="context">{value}</span>
