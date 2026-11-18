<!-- A runOnMainThread call from a component's top-level script, and one from an effect. -->
<script lang="ts">
	import { mainThreadRef, runOnMainThread } from "@sohedra/lynx";

	let { api }: { api: Record<string, unknown> } = $props();
	const runs = mainThreadRef({ top: 0, effect: 0 });

	// The main thread's own `lynx`: one count for the page, whichever copy runs.
	declare const lynx: { topRuns?: number };

	function fromTop() {
		"main thread";
		runs.current.top += 1;
		lynx.topRuns = (lynx.topRuns ?? 0) + 1;
	}

	function fromEffect() {
		"main thread";
		runs.current.effect += 1;
	}

	function read() {
		"main thread";
		return { ...runs.current, topOnThisThread: lynx.topRuns ?? 0 };
	}

	void runOnMainThread(fromTop)();
	$effect(() => {
		void runOnMainThread(fromEffect)();
	});
	api["read"] = () => runOnMainThread(read)();
</script>

<view class="box"></view>
