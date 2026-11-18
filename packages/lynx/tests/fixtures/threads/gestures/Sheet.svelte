<!--
	A sheet as the UI library writes one: its pan comes through a spread, built in $derived from the
	scroll gestures of the scroll views inside it, which register themselves, and from a value its
	callback reads. A slider's gesture comes through a spread object built once.
-->
<script lang="ts">
	import { mainThreadRef, runOnBackground } from "@sohedra/lynx";
	import { waitFor } from "@sohedra/lynx/experimental";
	import { PanGesture } from "@sohedra/lynx/gesture";
	import type { GestureKind, PanGestureChangeEvent, StateManager } from "@sohedra/lynx/gesture";
	import { SvelteSet } from "svelte/reactivity";

	import SheetScroll from "./SheetScroll.svelte";

	let { log, api }: { log: unknown[]; api: Record<string, unknown> } = $props();
	const scrolls = new SvelteSet<GestureKind>();
	const offset = mainThreadRef(0);
	let snap = $state("closed");
	let second = $state(false);

	function note(...args: unknown[]) {
		log.push(args);
	}

	function onUpdate(event: PanGestureChangeEvent, state: StateManager) {
		"main thread";
		state.active();
		offset.current = event.params.y;
		event.currentTarget.setStyleProperty("transform", `translateY(${offset.current}px)`);
		void runOnBackground(note)("drag", snap, offset.current);
	}

	function onSlide(event: PanGestureChangeEvent) {
		"main thread";
		event.currentTarget.setAttribute("slid", event.params.x);
	}

	const swipe = $derived(waitFor(new PanGesture({ minDistance: 4, onUpdate }), [...scrolls]));
	const sheetProps = $derived({ "main-thread:gesture": swipe });
	const sliderProps = { "main-thread:gesture": new PanGesture({ onUpdate: onSlide }) };
	api["snap"] = (next: string) => (snap = next);
	api["second"] = () => (second = true);
</script>

<view class="sheet" {...sheetProps}>
	<SheetScroll name="first" {scrolls} />
	{#if second}<SheetScroll name="second" {scrolls} />{/if}
</view>
<view class="slider" {...sliderProps}></view>
