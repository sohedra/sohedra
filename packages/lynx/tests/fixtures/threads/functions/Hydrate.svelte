<!--
	Main-thread functions across hydration: a handler that counts in a ref and calls the background,
	a function ref that runs in the first frame, one whose captured value differs on the background,
	a closure the first frame keeps in a ref, and functions in each branch of {#if background}.
-->
<script lang="ts">
	import { mainThreadRef, runOnBackground, runOnMainThread } from "@sohedra/lynx";
	import { background, mainThread } from "@sohedra/lynx/env";

	interface Element {
		setAttribute(name: string, value: unknown): void;
		setStyleProperty(name: string, value: string): void;
	}

	let { log, api }: { log: unknown[]; api: Record<string, unknown> } = $props();
	const taps = mainThreadRef(0);
	const saved = mainThreadRef<(() => void) | null>(null);
	const outer = mainThreadRef<Element | null>(null);
	const where = mainThread ? "frame" : "background";

	function note(...args: unknown[]) {
		log.push(args);
	}

	function bump(by: number) {
		"main thread";
		taps.current += by;
		void runOnBackground(note)("bump", taps.current);
	}

	function onTap() {
		"main thread";
		bump(1);
		saved.current ??= () => {
			bump(10);
			void runOnBackground(note)("saved");
		};
	}

	function onSaved() {
		"main thread";
		saved.current?.();
	}

	function attachOnce() {
		"main thread";
		void runOnBackground(note)("once");
		return () => {
			void runOnBackground(note)("once cleaned");
		};
	}

	function attachWhere(element: Element) {
		"main thread";
		element.setAttribute("ran-in", where);
		const ran = where;
		return () => outer.current?.setAttribute(`cleaned-${ran}`, "yes");
	}

	function attachBranch(element: Element) {
		"main thread";
		element.setStyleProperty("opacity", "0.5");
		return () => outer.current?.setAttribute("else-cleaned", "yes");
	}

	function onFrameOnly() {
		"main thread";
		runOnBackground(note)("frame only").catch((error: { code?: string }) => {
			outer.current?.setAttribute("frame-only", error.code ?? "?");
		});
	}

	function read() {
		"main thread";
		return taps.current;
	}

	function plain() {
		note("plain");
	}

	api["read"] = () => runOnMainThread(read)();
</script>

<view class="outer" main-thread:ref={outer}>
	<view class="tap" main-thread:ontap={onTap}></view>
	<view class="saved" main-thread:ontap={onSaved}></view>
	<view class="plain" ontap={plain}></view>
	<view class="once" main-thread:ref={attachOnce}></view>
	<view class="where" main-thread:ref={attachWhere}></view>
	{#if background}
		<view class="background" main-thread:ref={attachBranch}></view>
	{:else}
		<!-- Another tag: hydration makes the background's branch again in place. -->
		<text class="else" main-thread:ref={attachBranch} main-thread:ontap={onFrameOnly}></text>
	{/if}
</view>
