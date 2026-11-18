<!--
	A list whose rows each hold a function ref, a main-thread tap handler and, for the first row, a
	ref of the page: on a plain list, or deferred on Lynx's async list.
-->
<script lang="ts">
	import { mainThreadRef, runOnMainThread } from "@sohedra/lynx";

	import FunctionRow from "./FunctionRow.svelte";

	let {
		log,
		api,
		count = 40,
		async = false,
		defer = false,
		initial = 0,
	}: {
		log: unknown[];
		api: Record<string, unknown>;
		count?: number;
		async?: boolean;
		defer?: boolean | { unmountRecycled?: boolean };
		initial?: number;
	} = $props();
	const rows = $state(Array.from({ length: count }, (_, index) => index + 1));
	const counts = mainThreadRef({ runs: 0, cleanups: 0 });
	const first = mainThreadRef<{ dataset: Record<string, unknown> } | null>(null);

	function read() {
		"main thread";
		return { ...counts.current, first: first.current?.dataset["id"] ?? null };
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
			<FunctionRow {id} {log} {counts} {first} />
		</list-item>
	{/each}
</list>
