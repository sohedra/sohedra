<script lang="ts">
	// A main-thread ref read on the background, where `.current` is only the initial value; and a
	// second one that is not read.
	import { mainThreadRef } from "@sohedra/lynx";

	let { results }: { results: unknown[] } = $props();

	const counter = mainThreadRef(5);
	const other = mainThreadRef(6);
	void other;

	const read = () => {
		results.push(counter.current, counter.current);
	};
</script>

<view class="read" ontap={read}></view>
