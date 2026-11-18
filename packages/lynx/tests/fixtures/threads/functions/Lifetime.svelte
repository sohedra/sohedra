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

	// The main thread's own `lynx`: a timer of the page that outlives it, and where the timer's call
	// says how it ended (its element may be gone by then).
	declare const lynx: { setTimeout(callback: () => void, delay: number): void; late?: string };

	let { api }: { api: Record<string, unknown> } = $props();

	function note() {}

	function onTap() {
		"main thread";
		sharedCount.current += 1;
		lynx.setTimeout(() => {
			runOnBackground(note)().then(
				() => (lynx.late = "answered"),
				(error: { code?: string }) => (lynx.late = error.code ?? "?"),
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
