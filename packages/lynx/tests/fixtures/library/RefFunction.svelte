<script lang="ts">
	// `main-thread:ref` given main-thread functions: each reports to `log` on the background what it
	// was called with and marks the element it was given. `which` picks the one on the element,
	// `shown` whether the element is there.
	import { runOnBackground } from "@sohedra/lynx";
	import type { MainThread } from "@sohedra/lynx/elements";

	let {
		log,
		which = "a",
		shown = true,
	}: { log: unknown[]; which?: "a" | "b" | "clean" | "quiet" | null; shown?: boolean } = $props();

	// Captured by the functions, as any variable a main-thread function reads.
	const name = "ref";
	const report = (value: unknown) => {
		log.push(value);
	};

	function a(element: MainThread.Element | null) {
		"main thread";
		element?.setAttribute("seen-by", "a");
		void runOnBackground(report)(`${name} a ${element === null ? "null" : "element"}`);
	}

	// Does not call the background: the one that runs in a first frame alone.
	function quiet(element: MainThread.Element | null) {
		"main thread";
		element?.setAttribute("seen-by", "quiet");
	}

	function b(element: MainThread.Element | null) {
		"main thread";
		element?.setAttribute("seen-by", "b");
		void runOnBackground(report)(`${name} b ${element === null ? "null" : "element"}`);
	}

	// Returns what to do at the end, as an effect does.
	function clean(element: MainThread.Element | null) {
		"main thread";
		element?.setAttribute("seen-by", "clean");
		void runOnBackground(report)(`${name} clean ${element === null ? "null" : "element"}`);
		return () => {
			void runOnBackground(report)(`${name} clean is over`);
		};
	}

	const functions = { a, b, clean, quiet };
</script>

{#if shown}
	<view class="box" main-thread:ref={which === null ? null : functions[which]}></view>
{/if}
