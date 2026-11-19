<script lang="ts">
	// A main-thread function declaration that hands the background functions declared above it with
	// `const`: its object holds a handle to each, so it is made where it is written.
	import { runOnBackground, runOnMainThread } from "@sohedra/lynx";

	let { log }: { log: unknown[] } = $props();

	const report = (value: unknown) => log.push(value);
	const add = (a: number, b: number) => a + b;

	function sum(a: number, b: number): void {
		"main thread";
		void runOnBackground(add)(a, b).then((total) => runOnBackground(report)(`sum ${total}`));
	}
</script>

<view class="tap" ontap={() => runOnMainThread(sum)(1, 2)}></view>
