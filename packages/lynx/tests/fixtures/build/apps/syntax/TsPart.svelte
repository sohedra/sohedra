<script lang="ts">
	// TypeScript written to compare: the parentheses say so to TypeScript, and Svelte's printer drops
	// them (`a < b > (c, 0)`), which JavaScript reads as the comparison and TypeScript as a call. And
	// a main-thread function with types, which the main thread's copy carries without them.
	import { runOnBackground } from "@sohedra/lynx";

	const a: number = 1;
	const b: number = 2;
	const c: number = 0;
	// prettier-ignore
	const compared: boolean[] = [
		(a < b) > `0`,
		(a < b) > (c, 0),
		(a < b) > (c ? 0 : 0),
	];

	let pressed = $state(0);
	const press = (size: number): void => {
		pressed = size;
	};

	function widen(event: {
		currentTarget: { setStyleProperty(name: string, value: string): void };
	}) {
		"main thread";
		const size: number = (3 as number)!;
		event.currentTarget.setStyleProperty("width", `${size satisfies number}px`);
		void runOnBackground(press)(size);
	}
</script>

<text>typescript {compared.join(" ")}</text>
<view class="press" main-thread:ontap={widen}>
	<text>pressed {pressed}</text>
</view>
