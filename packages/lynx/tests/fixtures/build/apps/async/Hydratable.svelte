<!-- Calls Svelte's `hydratable`, which the first frame's synchronous render has no context for. -->
<script lang="ts">
	import { hydratable } from "svelte";

	const word = hydratable("word", () => "ready");
</script>

<view class="page"><text class="word">{word}</text></view>
