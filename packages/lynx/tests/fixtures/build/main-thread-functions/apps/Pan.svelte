<script lang="ts">
	import { mainThreadRef, runOnBackground } from "@sohedra/lynx";
	import {
		ExclusiveGesture,
		PanGesture,
		TapGesture,
		type PanGestureChangeEvent,
		type StateManager,
	} from "@sohedra/lynx/gesture";

	const box = mainThreadRef<{ setStyleProperty(name: string, value: string): void } | null>(null);
	let dropped = $state("");

	function report(x: number) {
		dropped = `dropped at ${x}`;
	}

	function onUpdate(event: PanGestureChangeEvent, state: StateManager) {
		"main thread";
		state.active();
		box.current?.setStyleProperty("transform", `translateX(${event.params.pageX}px)`);
	}

	function onEnd(event: PanGestureChangeEvent) {
		"main thread";
		console.log("pan-ok");
		runOnBackground(report)(event.params.pageX);
	}

	function onTap() {
		"main thread";
		console.log("tap-ok");
	}

	const gesture = $derived(
		new ExclusiveGesture(new PanGesture({ onUpdate, onEnd }), new TapGesture({ onEnd: onTap })),
	);
</script>

<view main-thread:ref={box} main-thread:gesture={gesture}>
	<text>{dropped}</text>
</view>
