<!-- A call made from an effect at mount, in the patch that binds a function ref. -->
<script lang="ts">
	import { mainThreadRef, runOnMainThread } from "@sohedra/lynx";

	let { log }: { log: unknown[] } = $props();
	const registered = mainThreadRef<string | null>(null);

	function attach(element: { dataset: Record<string, unknown> }) {
		"main thread";
		registered.current = String(element.dataset["name"]);
	}

	function read() {
		"main thread";
		return registered.current;
	}

	$effect(() => {
		void runOnMainThread(read)().then((value) => log.push(value));
	});
</script>

<view class="thumb" data-name="thumb" main-thread:ref={attach}></view>
