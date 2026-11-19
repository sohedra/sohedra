<script lang="ts">
	// Main-thread functions as an app writes them: a handler, calls from the background, a call back
	// to it, and a ref to an element. Each one reports through `log` on the background.
	import { mainThreadRef, runOnBackground, runOnMainThread } from "@sohedra/lynx";

	let { log }: { log: unknown[] } = $props();

	const box = mainThreadRef<unknown>(null);
	const report = (value: unknown) => log.push(value);
	const add = (a: number, b: number) => a + b;

	function double(value: number): number {
		"main thread";
		return value * 2;
	}

	function sum(a: number, b: number): void {
		"main thread";
		void runOnBackground(add)(a, b).then((total) => runOnBackground(report)(`sum ${total}`));
	}

	function boxIsBound(): boolean {
		"main thread";
		return box.current !== null;
	}
</script>

<view
	class="box"
	main-thread:ref={box}
	main-thread:ontap={(event) => {
		"main thread";
		void runOnBackground(report)(`main-thread ${event.type}`);
	}}
>
	<text>Box</text>
</view>
<view class="double" ontap={() => runOnMainThread(double)(21).then(report)}></view>
<view class="sum" ontap={() => runOnMainThread(sum)(1, 2)}></view>
<view
	class="bound"
	ontap={() => runOnMainThread(boxIsBound)().then((bound) => report(`bound ${bound}`))}
></view>
