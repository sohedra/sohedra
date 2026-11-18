<!-- A row that swipes, through a spread as a library passes its gesture. -->
<script lang="ts">
	import type { MainThreadRef } from "@sohedra/lynx";
	import { PanGesture } from "@sohedra/lynx/gesture";
	import type { PanGestureChangeEvent, StateManager } from "@sohedra/lynx/gesture";

	let { id, moves }: { id: number; moves: MainThreadRef<number> } = $props();

	function onUpdate(event: PanGestureChangeEvent, state: StateManager) {
		"main thread";
		state.active();
		moves.current += 1;
		event.currentTarget.setStyleProperty("transform", `translateX(${event.params.x}px)`);
	}

	const swipe = $derived({ "main-thread:gesture": new PanGesture({ minDistance: 4, onUpdate }) });
</script>

<view class="row row-{id}" data-id={id} {...swipe}><text>row {id}</text></view>
