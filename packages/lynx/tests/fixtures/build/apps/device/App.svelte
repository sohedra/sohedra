<script lang="ts">
	// What a first page uses: state, a tap, a keyed list, a `style` with a `style:` directive, state
	// with an effect made as its modules load, and a main-thread handler that keeps a ref, reads
	// state, and calls the background.
	// The page itself uses nothing a device's engine lacks.
	import { mainThreadRef, runOnBackground } from "@sohedra/lynx";
	import { PanGesture } from "@sohedra/lynx/gesture";
	import type { PanGestureChangeEvent, StateManager } from "@sohedra/lynx/gesture";

	import { clock } from "./clock.svelte.ts";

	let count = $state(0);
	let fruits = $state([
		{ id: 1, name: "Apple" },
		{ id: 2, name: "Banana" },
	]);

	let presses = $state(0);
	let pressedOn = $state("");
	const pressed = mainThreadRef(0);

	function onPressed(count: number, on = "") {
		presses = count;
		pressedOn = on;
	}

	function press(event: {
		currentTarget: { setStyleProperty(name: string, value: string): void };
	}) {
		"main thread";
		pressed.current += 1;
		event.currentTarget.setStyleProperty("width", `${pressed.current}px`);
		void runOnBackground(onPressed)(pressed.current, ` (${fruits[0]!.name}, ${count})`);
	}

	function drag(event: PanGestureChangeEvent, state: StateManager) {
		"main thread";
		state.active();
		pressed.current += 1;
		event.currentTarget.setStyleProperty("height", `${event.params.y}px`);
		void runOnBackground(onPressed)(pressed.current);
	}

	const pan = $derived(new PanGesture({ minDistance: 4, onUpdate: drag }));

	function tap() {
		count++;
		clock.ticks++;
		fruits.reverse();
	}
</script>

<view class="page" style="padding: 8px" style:opacity={count % 2 === 0 ? 1 : 0.5}>
	<view class="button" ontap={tap}>
		<text>Tapped {count}, seen {clock.seen}</text>
	</view>
	<view class="press" main-thread:ontap={press}>
		<text>Pressed {presses}{pressedOn}</text>
	</view>
	<view class="drag" main-thread:gesture={pan}></view>
	{#each fruits as fruit (fruit.id)}
		<text>{fruit.name}</text>
	{/each}
</view>
