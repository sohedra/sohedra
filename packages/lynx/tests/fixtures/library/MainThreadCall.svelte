<script lang="ts">
	import { runOnMainThread } from "@sohedra/lynx";

	let { results }: { results: unknown[] } = $props();

	function measure(): number {
		"main thread";
		return 1;
	}

	const ask = () =>
		runOnMainThread(measure)().then(
			(value) => results.push({ ok: value }),
			(error: Error) => results.push({ error: error.message }),
		);
</script>

<view class="ask" ontap={ask}></view>
