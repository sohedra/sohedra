<script lang="ts">
	// A ref no element binds (no `main-thread:ref`), used only by a main-thread function called with
	// runOnMainThread.
	import { mainThreadRef, runOnMainThread } from "@sohedra/lynx";

	let { results }: { results: unknown[] } = $props();

	const counter = mainThreadRef(41);

	function bump(): string {
		"main thread";
		const before = counter.current;
		counter.current = before + 1;
		return `before=${before} after=${counter.current}`;
	}

	const ask = () =>
		runOnMainThread(bump)().then(
			(value) => results.push(value),
			(error: Error) => results.push({ error: error.message }),
		);
</script>

<view class="ask" ontap={ask}></view>
