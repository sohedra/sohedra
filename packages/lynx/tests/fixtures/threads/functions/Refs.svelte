<!--
	Main-thread refs: one that moves between two elements, one that two elements hold (one of them
	drawn by the first frame alone), a function ref whose captured value changes and whose element
	comes and goes, one that throws, and a handler that checks the element it gets against the
	ref's.
-->
<script lang="ts">
	import { mainThreadRef, runOnBackground, runOnMainThread } from "@sohedra/lynx";
	import { mainThread } from "@sohedra/lynx/environment";
	import { flushSync } from "svelte";

	interface Element {
		readonly parentElement: Element | null;
		readonly dataset: Record<string, unknown>;
		contains(other: unknown): boolean;
		setStyleProperty(name: string, value: string): void;
	}

	let { log, api }: { log: unknown[]; api: Record<string, unknown> } = $props();
	let show = $state(true);
	let first = $state(true);
	let label = $state("a");
	let width = $state(10);
	let flash = $state(false);
	const box = mainThreadRef<Element | null>(null);
	const shared = mainThreadRef<Element | null>(null);
	let extra = $state(false);

	function note(...args: unknown[]) {
		log.push(args);
	}

	function attach(element: Element) {
		"main thread";
		const name = label;
		void runOnBackground(note)(
			"attach",
			name,
			element.parentElement !== null,
			element.dataset["role"],
		);
		return () => {
			void runOnBackground(note)("cleanup", name);
		};
	}

	function attachFlash() {
		"main thread";
		void runOnBackground(note)("flash");
	}

	function broken() {
		"main thread";
		throw new Error("The ref threw.");
	}

	function onTap(event: { target: Element; currentTarget: Element }) {
		"main thread";
		const holder = box.current?.parentElement;
		void runOnBackground(note)(
			"tap",
			event.currentTarget === box.current,
			holder?.contains(event.target) ?? false,
			holder?.dataset["role"],
		);
		box.current?.setStyleProperty("transform", "translateX(5px)");
	}

	function read() {
		"main thread";
		return box.current?.dataset["role"] ?? null;
	}

	function readShared() {
		"main thread";
		return shared.current?.dataset["role"] ?? null;
	}

	api["read"] = () => runOnMainThread(read)();
	api["readShared"] = () => runOnMainThread(readShared)();
	api["addExtra"] = () => (extra = true);
	api["dropExtra"] = () => (extra = false);
	api["move"] = () => (first = !first);
	api["hide"] = () => (show = false);
	api["show"] = () => (show = true);
	api["relabel"] = () => (label = "b");
	api["widen"] = () => (width += 10);
	// An element made and taken away again in one patch: its function ref never runs.
	api["flash"] = () => {
		flash = true;
		flushSync();
		flash = false;
		flushSync();
	};
</script>

<view class="holder" data-role="holder">
	<view
		class="first"
		data-role="first"
		style="width: {width}px"
		main-thread:ref={first ? box : undefined}
		main-thread:ontap={onTap}
	>
		<view class="inner"></view>
	</view>
	<view class="second" data-role="second" main-thread:ref={first ? undefined : box}></view>
</view>
<view class="kept" data-role="kept" main-thread:ref={shared}></view>
{#if mainThread}
	<view class="drawn-only" data-role="drawn-only" main-thread:ref={shared}></view>
{/if}
{#if extra}
	<view class="extra" data-role="extra" main-thread:ref={shared}></view>
{/if}
{#if show}
	<view class="attached" data-role="attached" main-thread:ref={attach}></view>
{/if}
<view class="broken" main-thread:ref={broken}></view>
{#if flash}
	<view class="flash" main-thread:ref={attachFlash}></view>
{/if}
<text class="after">after</text>
