<!-- A UI method called by a function the background runs in the patch that makes the element. -->
<script lang="ts">
	import { mainThreadRef, runOnMainThread } from "@sohedra/lynx";

	interface Element {
		invoke(method: string): Promise<unknown>;
	}

	let { log, api }: { log: unknown[]; api: Record<string, unknown> } = $props();
	let more = $state(false);
	const late = mainThreadRef<Element | null>(null);

	function measure() {
		"main thread";
		return late.current!.invoke("boundingClientRect");
	}

	$effect(() => {
		if (!more) return;
		runOnMainThread(measure)().then(
			(value) => log.push(["measured", value]),
			(error: { code?: string }) => log.push(["failed", error.code]),
		);
	});
	api["more"] = () => (more = true);
</script>

{#if more}
	<view class="late" main-thread:ref={late}></view>
{/if}
