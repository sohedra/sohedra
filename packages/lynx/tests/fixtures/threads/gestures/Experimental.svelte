<!--
	The experimental gestures on elements: a fling, the platform's own gesture and a long press,
	each with a callback that tells the background, and a pan that hands the touch on to the fling.
-->
<script lang="ts">
	import { runOnBackground } from "@sohedra/lynx";
	import { FlingGesture, LongPressGesture, NativeGesture } from "@sohedra/lynx/experimental";
	import type { GestureChangeEvent, StateManager } from "@sohedra/lynx/gesture";
	import { PanGesture } from "@sohedra/lynx/gesture";

	let { log }: { log: unknown[] } = $props();

	function note(...args: unknown[]) {
		log.push(args);
	}

	function heard(event: GestureChangeEvent, state: StateManager) {
		"main thread";
		state.active();
		void runOnBackground(note)(event.type, event.params.x);
	}

	const fling = $derived(new FlingGesture({ onUpdate: heard }));
	const native = $derived(new NativeGesture({ onBegin: heard }));
	const press = $derived(new LongPressGesture({ minDuration: 300, onStart: heard }));
	const handsOn = $derived(new PanGesture({ onEnd: heard, continueWith: [fling] }));
</script>

<view class="fling" main-thread:gesture={fling}></view>
<view class="native" main-thread:gesture={native}></view>
<view class="press" main-thread:gesture={press}></view>
<view class="hands-on" main-thread:gesture={handsOn}></view>
