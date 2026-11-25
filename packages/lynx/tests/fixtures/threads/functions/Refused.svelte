<!--
	A first frame the background cannot hydrate (an attribute differs outside any block),
	with a function ref, a main-thread handler that calls the background, and a ref.
-->
<script lang="ts">
	import { mainThreadRef, runOnBackground, runOnMainThread } from "@sohedra/lynx";
	import { mainThread } from "@sohedra/lynx/environment";

	interface Element {
		setAttribute(name: string, value: unknown): void;
	}

	let { log, api }: { log: unknown[]; api: Record<string, unknown> } = $props();
	const counts = mainThreadRef({ runs: 0, cleanups: 0, taps: 0 });
	const side = mainThread ? "frame" : "background";

	function note(...args: unknown[]) {
		log.push(args);
	}

	function attach(element: Element) {
		"main thread";
		counts.current.runs += 1;
		element.setAttribute("attached", counts.current.runs);
		void runOnBackground(note)("attached");
		return () => {
			counts.current.cleanups += 1;
		};
	}

	function onTap() {
		"main thread";
		counts.current.taps += 1;
		runOnBackground(note)("tap", counts.current.taps).catch((error: { code?: string }) => {
			runOnBackground(note)("tap failed", error.code).catch(() => {});
		});
	}

	function read() {
		"main thread";
		return { ...counts.current };
	}

	api["read"] = () => runOnMainThread(read)();
</script>

<view class="outer" data-side={side}>
	<view class="tap" main-thread:ontap={onTap} main-thread:ref={attach}></view>
</view>
