<!-- Contexts and wrappers that nothing lets go of. -->
<script lang="ts">
	import { mainThreadRef, runOnBackground } from "@sohedra/lynx";

	interface Element {
		readonly parentElement: Element | null;
		setAttribute(name: string, value: unknown): void;
	}

	let { api }: { api: Record<string, unknown> } = $props();
	let big = $state(false);
	let unknown = $state(false);
	let shown = $state(true);
	const huge = 10n;
	const kept = mainThreadRef<Element | null>(null);

	function note() {}

	function onBig() {
		"main thread";
		void runOnBackground(note)();
		console.log(huge);
	}

	function onUnknown() {
		"main thread";
		void runOnBackground(note)();
	}

	function attach(element: Element) {
		"main thread";
		return () => {
			// A cleanup that looks at where its element was.
			element.parentElement?.setAttribute("child-left", "yes");
		};
	}

	function onKeep(event: { target: Element }) {
		"main thread";
		kept.current = event.target;
	}

	function onWrite() {
		"main thread";
		kept.current?.setAttribute("late", "yes");
	}

	function onUse() {
		"main thread";
		kept.current?.parentElement?.setAttribute("used", "yes");
	}

	api["set"] = (name: string, value: boolean) => {
		if (name === "big") big = value;
		if (name === "unknown") unknown = value;
		if (name === "shown") shown = value;
	};
</script>

{#if big}
	<view class="big" main-thread:ontap={onBig}></view>
{/if}
{#if unknown}
	<view class="unknown" {...{ "main-thread:nope": onUnknown }}></view>
{/if}
{#if shown}
	<view class="outer">
		<view class="inner" main-thread:ref={attach} main-thread:ontap={onKeep}></view>
	</view>
{/if}
<view class="use" main-thread:ontap={onUse}></view>
<view class="write" main-thread:ontap={onWrite}></view>
