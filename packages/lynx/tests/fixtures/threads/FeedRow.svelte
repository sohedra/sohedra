<script lang="ts">
	// The UI library's shape of a row: a component whose root is the `<list-item>`, its row passed as
	// children, everything else spread onto the item.
	import type { Snippet } from "svelte";

	let { key, children, ...rest }: { key: string; children?: Snippet } & Record<string, unknown> =
		$props();
</script>

<list-item item-key={key} {...rest}>{@render children?.()}</list-item>
