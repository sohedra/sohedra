<!--
  A `tag` rendered with its final `props` and a `state` on `Part`: the props are handed over as the
  user's, which `Part` merges with nothing of its own.
-->
<script lang="ts">
	import { Part } from "#lib/foundation/kernel/index.js";

	let {
		tag,
		props = {},
		state = {},
	}: { tag: string; props?: Record<string, unknown>; state?: object } = $props();
</script>

<Part tag={tag as "div"} {state} user={props} />
