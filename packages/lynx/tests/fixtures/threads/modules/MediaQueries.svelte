<!-- `MediaQuery` from `svelte/reactivity`, read as the page renders. -->
<script lang="ts">
	import { MediaQuery } from "svelte/reactivity";

	const wide = new MediaQuery("min-width: 600px");
</script>

<view class="root">
	<text class="wide">{String(wide.current)}</text>
</view>
