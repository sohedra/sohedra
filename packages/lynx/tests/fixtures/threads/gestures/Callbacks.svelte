<!--
	Two gestures on one element, run together, whose callbacks move their own detectors along
	through the state manager, the experimental calls too; and a pan that begins only near the left
	edge, which checks where the touch began and gives it up elsewhere. The callbacks capture values
	named as the runtime might name its own (`id`, `element`, `state`), which stay theirs.
-->
<script lang="ts">
	import { runOnBackground } from "@sohedra/lynx";
	import { SimultaneousGesture } from "@sohedra/lynx/experimental";
	import type { ExperimentalStateManager } from "@sohedra/lynx/experimental";
	import { PanGesture, TapGesture } from "@sohedra/lynx/gesture";
	import type { PanGestureChangeEvent, StateManager } from "@sohedra/lynx/gesture";

	let { log }: { log: unknown[] } = $props();
	const id = "mine";
	const element = 7;
	const state = { named: "state" };
	const EDGE = 20;

	function note(...args: unknown[]) {
		log.push(args);
	}

	function onPanBegin(event: PanGestureChangeEvent, manager: StateManager) {
		"main thread";
		manager.active();
		event.currentTarget.setStyleProperty("opacity", "0.5");
		void runOnBackground(note)("pan begin", event.params.pageX, id, element, state.named);
	}

	function onPanEnd(_event: PanGestureChangeEvent, manager: StateManager) {
		"main thread";
		manager.end();
	}

	function onTapStart(_event: PanGestureChangeEvent, manager: StateManager) {
		"main thread";
		manager.fail();
	}

	function onTapEnd(_event: PanGestureChangeEvent, manager: StateManager) {
		"main thread";
		(manager as ExperimentalStateManager).consumeGesture(true);
		(manager as ExperimentalStateManager).interceptGesture(false);
	}

	function onEdgeBegin(event: PanGestureChangeEvent, manager: StateManager) {
		"main thread";
		if (event.params.x > EDGE) {
			manager.fail();
			return;
		}
		manager.active();
		void runOnBackground(note)("edge", event.params.x);
	}

	const both = $derived(
		new SimultaneousGesture(
			new PanGesture({ onBegin: onPanBegin, onEnd: onPanEnd }),
			new TapGesture({ onStart: onTapStart, onEnd: onTapEnd }),
		),
	);
	const edge = $derived(new PanGesture({ onBegin: onEdgeBegin }));
</script>

<view class="surface" main-thread:gesture={both}></view>
<view class="edge" main-thread:gesture={edge}></view>
