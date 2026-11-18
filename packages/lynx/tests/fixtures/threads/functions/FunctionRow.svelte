<script lang="ts">
	import { runOnBackground } from "@sohedra/lynx";
	import type { MainThreadRef } from "@sohedra/lynx";

	let {
		id,
		log,
		counts,
		first,
	}: {
		id: number;
		log: unknown[];
		counts: MainThreadRef<{ runs: number; cleanups: number }>;
		first: MainThreadRef<unknown>;
	} = $props();

	function note(...args: unknown[]) {
		log.push(args);
	}

	function attach(element: { setAttribute(name: string, value: unknown): void }) {
		"main thread";
		counts.current.runs += 1;
		element.setAttribute("attached", id);
		return () => {
			counts.current.cleanups += 1;
		};
	}

	function onTap() {
		"main thread";
		void runOnBackground(note)("tap", id);
	}
</script>

<view class="row row-{id}" data-id={id} main-thread:ref={attach} main-thread:ontap={onTap}>
	<view class="first" data-id={id} main-thread:ref={id === 1 ? first : undefined}></view>
</view>
