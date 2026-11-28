<!--
  `Part` rendering a `tag` with a `state`, given `user` as its user's props: the part adds nothing
  of its own, so the element shows only what `Part` itself writes.
-->
<script lang="ts">
	import { Part } from "#lib/foundation/kernel/index.js";

	let {
		tag,
		user = {},
		state = {},
	}: { tag: string; user?: Record<string, unknown>; state?: object } = $props();
</script>

<Part tag={tag as "div"} {state} {user} />
