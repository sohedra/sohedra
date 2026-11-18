<!--
	A list whose rows each hold a swipe: a pan that moves its row and counts moves in a ref of the
	page. On a plain list, or deferred on Lynx's async list.
-->
<script lang="ts">
	import { mainThreadRef, runOnMainThread } from "@sohedra/lynx";

	import GestureRow from "./GestureRow.svelte";

	let {
		api,
		count = 40,
		async = false,
		defer = false,
		initial = 0,
	}: {
		api: Record<string, unknown>;
		count?: number;
		async?: boolean;
		defer?: boolean | { unmountRecycled?: boolean };
		initial?: number;
	} = $props();
	const rows = $state(Array.from({ length: count }, (_, index) => index + 1));
	const moves = mainThreadRef(0);

	function read() {
		"main thread";
		return moves.current;
	}

	api["read"] = () => runOnMainThread(read)();
	api["rows"] = rows;
</script>

<list
	class="list"
	custom-list-name={async ? "list-container" : undefined}
	initial-item-count={initial}
>
	{#each rows as id (id)}
		<list-item item-key="r{id}" {defer}>
			<GestureRow {id} {moves} />
		</list-item>
	{/each}
</list>
