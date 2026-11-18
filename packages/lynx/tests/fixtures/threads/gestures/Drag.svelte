<!--
	A pan as an app writes one: built in $derived from state its callbacks read, so the background
	builds it again when that state changes. Its callbacks count moves in a ref, move the element,
	take the touch and tell the background. `api` changes what the gesture holds: a captured value,
	its distance, its type and whether it is there.
-->
<script lang="ts">
	import { mainThreadRef, runOnBackground } from "@sohedra/lynx";
	import { PanGesture, TapGesture } from "@sohedra/lynx/gesture";
	import type { PanGestureChangeEvent, StateManager } from "@sohedra/lynx/gesture";

	let { log, api }: { log: unknown[]; api: Record<string, unknown> } = $props();
	const moves = mainThreadRef(0);
	let label = $state("a");
	let distance = $state(0);
	let tap = $state(false);
	let shown = $state(true);

	function note(...args: unknown[]) {
		log.push(args);
	}

	function onBegin(event: PanGestureChangeEvent, state: StateManager) {
		"main thread";
		state.active();
		void runOnBackground(note)("begin", label, event.params.x);
	}

	function onUpdate(event: PanGestureChangeEvent) {
		"main thread";
		moves.current += 1;
		event.currentTarget.setStyleProperty("transform", `translateX(${event.params.x}px)`);
		void runOnBackground(note)("update", label, moves.current);
	}

	function onEnd(_event: PanGestureChangeEvent, state: StateManager) {
		"main thread";
		state.end();
		void runOnBackground(note)("end", label);
	}

	const gesture = $derived(
		tap
			? new TapGesture({ onEnd })
			: new PanGesture({ minDistance: distance, onBegin, onUpdate, onEnd }),
	);
	api["label"] = (next: string) => (label = next);
	api["distance"] = (next: number) => (distance = next);
	api["tap"] = () => (tap = true);
	api["hide"] = () => (shown = false);
	api["show"] = () => (shown = true);
</script>

<view class="dragged" main-thread:gesture={shown ? gesture : undefined}></view>
