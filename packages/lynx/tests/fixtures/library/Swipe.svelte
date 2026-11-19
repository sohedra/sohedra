<script lang="ts">
	// A pan that moves its element with the finger and tells the background when it ends, with how
	// fast the finger went; and a tap beside it on another element.
	import { runOnBackground } from "@sohedra/lynx";
	import { SimultaneousGesture } from "@sohedra/lynx/experimental";
	import { PanGesture, TapGesture } from "@sohedra/lynx/gesture";
	import type { PanGestureChangeEvent, StateManager } from "@sohedra/lynx/gesture";

	let { log }: { log: unknown[] } = $props();
	const note = (value: unknown) => log.push(value);

	function onBegin(event: PanGestureChangeEvent, state: StateManager) {
		"main thread";
		state.active();
		void runOnBackground(note)(`begin ${event.params.x} at ${event.timestamp}`);
	}

	function onUpdate(event: PanGestureChangeEvent) {
		"main thread";
		event.currentTarget.setStyleProperty("transform", `translateX(${event.params.x}px)`);
	}

	function onEnd(event: PanGestureChangeEvent, state: StateManager) {
		"main thread";
		state.end();
		void runOnBackground(note)(`end at ${event.timestamp}`);
	}

	function tapped() {
		"main thread";
		void runOnBackground(note)("tap");
	}

	const pan = new PanGesture({ onBegin, onUpdate, onEnd });
	const both = new SimultaneousGesture(
		new PanGesture({ onBegin, onUpdate, onEnd }),
		new TapGesture({ onEnd: tapped }),
	);
</script>

<view class="sheet" main-thread:gesture={pan}><text>Sheet</text></view>
<view class="both" main-thread:gesture={both}></view>
