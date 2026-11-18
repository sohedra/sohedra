<!-- A ref the main thread knows, which the test lets go of. -->
<script lang="ts">
	import { runOnMainThread } from "@sohedra/lynx";
	import type { MainThreadRef } from "@sohedra/lynx";

	let { api }: { api: Record<string, unknown> } = $props();
	let ticks = $state(0);
	api["tick"] = () => (ticks += 1);
	/** Makes the main thread see the ref: a function that captures it runs there. */
	api["use"] = (ref: MainThreadRef<number>) => {
		function read() {
			"main thread";
			return ref.current;
		}
		return runOnMainThread(read)();
	};
</script>

<text class="ticks">{ticks}</text>
