<!--
	What outlives a page that reloads or ends: a timer a handler set, a function ref's cleanup, and
	a ref made at a module's top level.
-->
<script lang="ts">
	import { runOnBackground, runOnMainThread } from "@sohedra/lynx";

	import { sharedCount } from "./shared-count.ts";

	interface Element {
		setAttribute(name: string, value: unknown): void;
	}

	// The main thread's own: a timer of the page that outlives it.
	declare const lynx: { setTimeout(callback: () => void, delay: number): void };

	let { api }: { api: Record<string, unknown> } = $props();

	function note() {}

	function onTap(event: { currentTarget: Element }) {
		"main thread";
		const element = event.currentTarget;
		sharedCount.current += 1;
		lynx.setTimeout(() => {
			runOnBackground(note)().then(
				() => element.setAttribute("late", "answered"),
				(error: { code?: string }) => element.setAttribute("late", error.code ?? "?"),
			);
		}, 0);
	}

	function attach(element: Element) {
		"main thread";
		return () => element.setAttribute("cleaned", "yes");
	}

	function read() {
		"main thread";
		return sharedCount.current;
	}

	api["read"] = () => runOnMainThread(read)();
</script>

<view class="tap" main-thread:ontap={onTap} main-thread:ref={attach}></view>
